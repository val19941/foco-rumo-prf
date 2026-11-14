import { addDays, dayKey, DAY_MS } from "./dates";
import type { ID, PlanAdjust, PlanBlock, Session, SessionKind, Settings, Subject } from "./types";

export interface SubjectStats {
  questions: number;
  correct: number;
  accuracy: number | null;
  minutes: number;
  lastReview: Date | null;
  nextReview: Date | null;
  sessions: number;
}

export function subjectStats(s: Subject, sessions: Session[]): SubjectStats {
  let questions = 0;
  let correct = 0;
  let minutes = 0;
  let count = 0;
  let last: number | null = null;
  for (const x of sessions) {
    if (x.subjectId !== s.id) continue;
    questions += x.questions;
    correct += x.correct;
    minutes += x.studiedMin;
    count++;
    const t = new Date(x.startedAt).getTime();
    if (last === null || t > last) last = t;
  }
  let next: number | null = null;
  for (const t of s.topics) {
    if (t.lastReview) {
      const v = new Date(t.lastReview).getTime();
      if (last === null || v > last) last = v;
    }
    if (t.nextReview) {
      const v = new Date(t.nextReview).getTime();
      if (next === null || v < next) next = v;
    }
  }
  return {
    questions,
    correct,
    accuracy: questions > 0 ? (correct / questions) * 100 : null,
    minutes,
    lastReview: last === null ? null : new Date(last),
    nextReview: next === null ? null : new Date(next),
    sessions: count,
  };
}

export interface PriorityBreakdown {
  score: number;
  importance: number;
  difficulty: number;
  accuracy: number;
  recency: number;
  mastery: number;
}

export const PRIORITY_WEIGHTS = {
  importance: 0.25,
  difficulty: 0.15,
  accuracy: 0.25,
  recency: 0.15,
  mastery: 0.2,
} as const;

/**
 * Priority 0–1 combining: importance in the edital, difficulty, accuracy (lower = higher priority),
 * days since last review (14+ days or never = max) and declared mastery (lower = higher priority).
 */
export function priorityScore(s: Subject, stats: SubjectStats, now: Date): PriorityBreakdown {
  const importance = clamp01(s.importance / 5);
  const difficulty = clamp01(s.difficulty / 5);
  const accuracy = 1 - clamp01((stats.accuracy ?? 50) / 100);
  const recency = stats.lastReview
    ? clamp01((now.getTime() - stats.lastReview.getTime()) / DAY_MS / 14)
    : 1;
  const mastery = 1 - clamp01(s.mastery / 10);
  const W = PRIORITY_WEIGHTS;
  const score =
    W.importance * importance +
    W.difficulty * difficulty +
    W.accuracy * accuracy +
    W.recency * recency +
    W.mastery * mastery;
  return { score, importance, difficulty, accuracy, recency, mastery };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export interface PlanInput {
  subjects: Subject[];
  sessions: Session[];
  settings: Pick<Settings, "availability" | "blockMin">;
  adjustments: Record<ID, PlanAdjust>;
  start: Date;
  now: Date;
  days?: number;
  idFactory?: () => string;
}

/** Allocates blocks across subjects proportional to priority, capped so no subject dominates the week. */
export function allocateBlocks(scores: { id: ID; score: number }[], total: number): Map<ID, number> {
  const alloc = new Map<ID, number>();
  const active = scores.filter((s) => s.score > 0);
  if (!active.length || total <= 0) return alloc;
  const cap = Math.max(1, Math.ceil(total * 0.25));
  let remaining = total;
  if (total >= active.length) {
    for (const s of active) alloc.set(s.id, 1);
    remaining -= active.length;
  }
  // Iteratively assign remaining blocks to the subject with the largest unmet share.
  const sum = active.reduce((a, s) => a + s.score, 0);
  while (remaining > 0) {
    let best: { id: ID; deficit: number } | null = null;
    for (const s of active) {
      const have = alloc.get(s.id) ?? 0;
      if (have >= cap) continue;
      const deficit = (s.score / sum) * total - have;
      if (!best || deficit > best.deficit) best = { id: s.id, deficit };
    }
    if (!best) break;
    alloc.set(best.id, (alloc.get(best.id) ?? 0) + 1);
    remaining--;
  }
  return alloc;
}

function chooseKind(focus: PlanAdjust["focus"] | undefined, mastery: number, idx: number): SessionKind {
  const f = focus ?? (mastery >= 7 ? "pratica" : mastery <= 3 ? "teoria" : "equilibrado");
  if (f === "pratica") return idx % 3 === 2 ? "teoria" : "questoes";
  if (f === "teoria") return idx % 3 === 2 ? "questoes" : "teoria";
  return idx % 2 === 0 ? "teoria" : "questoes";
}

/** Builds a week of study blocks, spreading disciplines and avoiding back-to-back repeats. */
export function generateWeekPlan(input: PlanInput): PlanBlock[] {
  const { subjects, sessions, settings, adjustments, start, now } = input;
  const days = input.days ?? 7;
  const mkId = input.idFactory ?? (() => Math.random().toString(36).slice(2));
  const blockMin = Math.max(15, settings.blockMin);

  const perDay: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    perDay.push(Math.floor((settings.availability[d.getDay()] ?? 0) / blockMin));
  }
  const total = perDay.reduce((a, b) => a + b, 0);

  const scored = subjects
    .map((s) => {
      const p = priorityScore(s, subjectStats(s, sessions), now).score;
      const factor = adjustments[s.id]?.factor ?? 1;
      return { id: s.id, score: p * factor };
    })
    .sort((a, b) => b.score - a.score);

  const alloc = allocateBlocks(scored, total);
  const scoreOf = new Map(scored.map((s) => [s.id, s.score]));
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const topicCursor = new Map<ID, number>();
  const kindCursor = new Map<ID, number>();

  const blocks: PlanBlock[] = [];
  for (let di = 0; di < days; di++) {
    const date = dayKey(addDays(start, di));
    const slots = perDay[di] ?? 0;
    const maxPerDay = Math.max(1, Math.ceil(slots / 3));
    const used = new Map<ID, number>();
    let prev: ID | null = null;
    for (let si = 0; si < slots; si++) {
      const candidates = [...alloc.entries()].filter(([, n]) => n > 0);
      if (!candidates.length) break;
      const rank = (list: [ID, number][]) =>
        list.sort((a, b) => b[1] - a[1] || (scoreOf.get(b[0]) ?? 0) - (scoreOf.get(a[0]) ?? 0))[0];
      const pick =
        rank(candidates.filter(([id]) => id !== prev && (used.get(id) ?? 0) < maxPerDay)) ??
        rank(candidates.filter(([id]) => id !== prev)) ??
        rank(candidates);
      if (!pick) break;
      const [sid] = pick;
      alloc.set(sid, (alloc.get(sid) ?? 1) - 1);
      used.set(sid, (used.get(sid) ?? 0) + 1);
      prev = sid;
      const subj = byId.get(sid);
      const topics = subj ? orderedTopics(subj) : [];
      const tc = topicCursor.get(sid) ?? 0;
      topicCursor.set(sid, tc + 1);
      const kc = kindCursor.get(sid) ?? 0;
      kindCursor.set(sid, kc + 1);
      blocks.push({
        id: mkId(),
        date,
        order: si,
        subjectId: sid,
        topicId: topics.length ? (topics[tc % topics.length]?.id ?? null) : null,
        minutes: blockMin,
        kind: chooseKind(adjustments[sid]?.focus, subj?.mastery ?? 5, kc),
        done: false,
      });
    }
  }
  return blocks;
}

/** Topics ordered for study: flagged first, then never studied, then oldest review. */
function orderedTopics(s: Subject) {
  return [...s.topics].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    if (!a.learnedAt !== !b.learnedAt) return a.learnedAt ? 1 : -1;
    return (a.lastReview ?? "").localeCompare(b.lastReview ?? "");
  });
}

export const KIND_LABEL: Record<SessionKind, string> = {
  teoria: "Teoria",
  questoes: "Questões",
  revisao: "Revisão",
};
