import { describe, expect, it } from "vitest";
import { insights } from "@/lib/analytics";
import { mentionsMedication } from "@/lib/advisor";
import { phaseAt } from "@/lib/medication";
import { allocateBlocks, generateWeekPlan, priorityScore, subjectStats } from "@/lib/planner";
import { completeReview, markLearned, prioritizeAfterErrors } from "@/lib/review";
import { createDefaultMed, createSeedSubjects } from "@/lib/seed";
import type { Session, Topic } from "@/lib/types";

const DAY = 86_400_000;
const INTERVALS = [1, 7, 15, 30];
const now = new Date("2026-03-02T08:00:00");

function topic(): Topic {
  return { id: "t", name: "T", subtopics: [], learnedAt: null, stage: 0, ease: 1, lastReview: null, nextReview: null, flagged: false, reviews: [] };
}
const daysUntil = (iso: string | null, from: Date) => Math.round((new Date(iso ?? 0).getTime() - from.getTime()) / DAY);

describe("revisão espaçada", () => {
  it("primeira revisão 24 h após estudar", () => {
    expect(daysUntil(markLearned(topic(), INTERVALS, now).nextReview, now)).toBe(1);
  });
  it("segue 7, 15 e 30 dias quando acerta entre 80% e 89%", () => {
    let t = markLearned(topic(), INTERVALS, now);
    const steps: number[] = [];
    for (let i = 0; i < 3; i++) {
      t = completeReview(t, 85, INTERVALS, now);
      steps.push(daysUntil(t.nextReview, now));
    }
    expect(steps).toEqual([7, 15, 30]);
  });
  it("acerto entre 60% e 79% repete o intervalo atual", () => {
    const t = completeReview({ ...markLearned(topic(), INTERVALS, now), stage: 1 }, 70, INTERVALS, now);
    expect(t.stage).toBe(1);
    expect(daysUntil(t.nextReview, now)).toBe(7);
  });
  it("erro (< 60%) volta para amanhã e marca como prioritário", () => {
    const t = completeReview({ ...markLearned(topic(), INTERVALS, now), stage: 2 }, 40, INTERVALS, now);
    expect(daysUntil(t.nextReview, now)).toBe(1);
    expect(t.flagged).toBe(true);
    expect(t.stage).toBe(1);
  });
  it("erros em questões antecipam a revisão", () => {
    const later = { ...markLearned(topic(), INTERVALS, now), nextReview: new Date(now.getTime() + 20 * DAY).toISOString() };
    const t = prioritizeAfterErrors(later, 50, now);
    expect(daysUntil(t.nextReview, now)).toBe(1);
    expect(t.flagged).toBe(true);
  });
});

describe("priorização e cronograma", () => {
  it("disciplina com mais peso e menos domínio tem prioridade maior", () => {
    const [a, b] = createSeedSubjects();
    const high = priorityScore({ ...a!, importance: 5, mastery: 1 }, subjectStats(a!, []), now).score;
    const low = priorityScore({ ...b!, importance: 1, mastery: 9 }, subjectStats(b!, []), now).score;
    expect(high).toBeGreaterThan(low);
  });
  it("nenhuma disciplina passa de 25% dos blocos", () => {
    const alloc = allocateBlocks([{ id: "a", score: 10 }, { id: "b", score: 1 }, { id: "c", score: 1 }, { id: "d", score: 1 }, { id: "e", score: 1 }], 20);
    expect(Math.max(...alloc.values())).toBeLessThanOrEqual(5);
  });
  it("não repete a mesma disciplina em blocos seguidos", () => {
    let n = 0;
    const blocks = generateWeekPlan({
      subjects: createSeedSubjects(),
      sessions: [],
      settings: { availability: [240, 240, 240, 240, 240, 240, 240], blockMin: 60 },
      adjustments: {},
      start: now,
      now,
      idFactory: () => String(n++),
    });
    expect(blocks).toHaveLength(28);
    for (let i = 1; i < blocks.length; i++)
      if (blocks[i]!.date === blocks[i - 1]!.date) expect(blocks[i]!.subjectId).not.toBe(blocks[i - 1]!.subjectId);
  });
});

describe("linha do tempo estimada", () => {
  it("liberação imediata: pico entre 60 e 120 min, fim em 240 min", () => {
    const med = createDefaultMed();
    const dose = new Date("2026-03-02T08:00:00");
    expect(phaseAt(dose, med, new Date("2026-03-02T09:30:00")).key).toBe("pico");
    expect(phaseAt(dose, med, new Date("2026-03-02T12:01:00")).key).toBe("encerrado");
  });
});

describe("segurança e observações", () => {
  it("detecta textos sobre dose ou medicamento", () => {
    expect(mentionsMedication("Aumente a dose pela manhã")).toBe(true);
    expect(mentionsMedication("Faça mais questões de CTB")).toBe(false);
  });
  it("gera observação de acertos por período sem citar a medicação", () => {
    const base: Omit<Session, "id" | "startedAt" | "correct"> = {
      subjectId: "portugues", topicId: null, kind: "questoes", startDelayMin: 5, studiedMin: 50, interruptions: 0, questions: 10, sleep: 6, anxiety: 3, fatigue: 3, notes: "",
      diary: { easeStart: 5, attention: 5, distractions: 0, source: "nenhuma", comprehension: 5, recall: 5, finishDifficulty: 5, energy: 5, focusQuality: 5 },
    };
    const s = (h: number, correct: number, i: number): Session => ({ ...base, id: String(i), correct, startedAt: new Date(2026, 2, i + 1, h).toISOString() });
    const list = [s(9, 9, 0), s(9, 8, 1), s(20, 5, 2), s(20, 6, 3)];
    const text = insights(createSeedSubjects(), list).map((x) => x.text).join(" ");
    expect(text).toContain("Língua Portuguesa foi maior nas sessões realizadas pela manhã");
    expect(mentionsMedication(text)).toBe(false);
  });
});
