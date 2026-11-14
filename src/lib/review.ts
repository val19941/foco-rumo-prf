import { DAY_MS, endOfDay } from "./dates";
import type { Subject, Topic } from "./types";

export const DEFAULT_INTERVALS = [1, 7, 15, 30];

function intervalFor(stage: number, intervals: number[], ease: number): number {
  const base =
    stage < intervals.length
      ? (intervals[stage] ?? 1)
      : (intervals[intervals.length - 1] ?? 30) * 2;
  return Math.max(1, Math.round(base * ease));
}

/** First contact with a topic: schedules the first review (default 24 h). */
export function markLearned(t: Topic, intervals: number[], now: Date): Topic {
  if (t.learnedAt) return t;
  return {
    ...t,
    learnedAt: now.toISOString(),
    stage: 0,
    nextReview: new Date(now.getTime() + intervalFor(0, intervals, t.ease) * DAY_MS).toISOString(),
  };
}

/**
 * Completes a review given its accuracy (0–100):
 * ≥ 80 advances to the next interval, 60–79 repeats the current interval,
 * < 60 steps back, reduces the multiplier and schedules for tomorrow with priority.
 */
export function completeReview(t: Topic, accuracy: number, intervals: number[], now: Date): Topic {
  let stage = t.stage;
  let ease = t.ease;
  let flagged = t.flagged;
  let days: number;
  if (accuracy >= 80) {
    stage = t.stage + 1;
    ease = Math.min(1.5, +(ease + 0.1).toFixed(2));
    flagged = false;
    days = intervalFor(stage, intervals, ease);
  } else if (accuracy >= 60) {
    days = intervalFor(stage, intervals, ease);
  } else {
    stage = Math.max(0, t.stage - 1);
    ease = Math.max(0.6, +(ease - 0.15).toFixed(2));
    flagged = true;
    days = 1;
  }
  return {
    ...t,
    learnedAt: t.learnedAt ?? now.toISOString(),
    stage,
    ease,
    flagged,
    lastReview: now.toISOString(),
    nextReview: new Date(now.getTime() + days * DAY_MS).toISOString(),
    reviews: [...t.reviews, { date: now.toISOString(), accuracy }],
  };
}

/** Errors in questions on a topic bring its review forward to tomorrow and flag it. */
export function prioritizeAfterErrors(t: Topic, accuracy: number, now: Date): Topic {
  if (accuracy >= 60) return t;
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const next = t.nextReview && new Date(t.nextReview) < tomorrow ? t.nextReview : tomorrow.toISOString();
  return { ...t, flagged: true, learnedAt: t.learnedAt ?? now.toISOString(), nextReview: next };
}

export interface ReviewItem {
  subject: Subject;
  topic: Topic;
  due: Date;
  overdueDays: number;
}

export function reviewItems(subjects: Subject[], now: Date): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const s of subjects)
    for (const t of s.topics) {
      if (!t.nextReview) continue;
      const due = new Date(t.nextReview);
      out.push({
        subject: s,
        topic: t,
        due,
        overdueDays: Math.floor((now.getTime() - due.getTime()) / DAY_MS),
      });
    }
  return out.sort((a, b) => {
    if (a.topic.flagged !== b.topic.flagged) return a.topic.flagged ? -1 : 1;
    return a.due.getTime() - b.due.getTime();
  });
}

export function pendingReviews(subjects: Subject[], now: Date): ReviewItem[] {
  const limit = endOfDay(now).getTime();
  return reviewItems(subjects, now).filter((r) => r.due.getTime() <= limit);
}

/** Spreads overdue/pending reviews of one subject over the next days (max per day). */
export function redistributeReviews(subject: Subject, now: Date, perDay = 2): Subject {
  const limit = endOfDay(now).getTime();
  const pending = subject.topics
    .filter((t) => t.nextReview && new Date(t.nextReview).getTime() <= limit)
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || (a.nextReview ?? "").localeCompare(b.nextReview ?? ""));
  const newDates = new Map<string, string>();
  pending.forEach((t, i) => {
    const offset = Math.floor(i / perDay);
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(8, 0, 0, 0);
    newDates.set(t.id, d.toISOString());
  });
  return {
    ...subject,
    topics: subject.topics.map((t) => (newDates.has(t.id) ? { ...t, nextReview: newDates.get(t.id) ?? t.nextReview } : t)),
  };
}

export function stageLabel(t: Topic): string {
  if (!t.learnedAt) return "Não iniciado";
  if (t.stage >= 4) return "Manutenção";
  return `${t.stage + 1}ª revisão`;
}
