import { z } from "zod";
import type { AppData } from "./types";

const scale = z.number().min(0).max(10);
const topic = z.object({
  id: z.string(),
  name: z.string(),
  subtopics: z.array(z.object({ id: z.string(), name: z.string(), done: z.boolean() })),
  learnedAt: z.string().nullable(),
  stage: z.number(),
  ease: z.number(),
  lastReview: z.string().nullable(),
  nextReview: z.string().nullable(),
  flagged: z.boolean(),
  reviews: z.array(z.object({ date: z.string(), accuracy: z.number() })),
});
const subject = z.object({
  id: z.string(),
  name: z.string(),
  importance: z.number(),
  difficulty: z.number(),
  mastery: z.number(),
  topics: z.array(topic),
});
const session = z.object({
  id: z.string(),
  startedAt: z.string(),
  subjectId: z.string().nullable(),
  topicId: z.string().nullable(),
  kind: z.enum(["teoria", "questoes", "revisao"]),
  startDelayMin: z.number(),
  studiedMin: z.number(),
  interruptions: z.number(),
  questions: z.number(),
  correct: z.number(),
  sleep: scale,
  anxiety: scale,
  fatigue: scale,
  diary: z.object({
    easeStart: scale,
    attention: scale,
    distractions: z.number(),
    source: z.enum(["nenhuma", "externa", "pensamentos", "ambos"]),
    comprehension: scale,
    recall: scale,
    finishDifficulty: scale,
    energy: scale,
    focusQuality: scale,
  }),
  notes: z.string(),
});

const backupSchema = z.object({
  app: z.literal("FocusStudy"),
  exportedAt: z.string(),
  data: z.object({
    version: z.literal(1),
    subjects: z.array(subject),
    sessions: z.array(session),
    doses: z.array(z.object({ id: z.string(), takenAt: z.string(), note: z.string() })),
    med: z.record(z.unknown()),
    plan: z
      .object({
        generatedAt: z.string(),
        startDate: z.string(),
        blocks: z.array(
          z.object({
            id: z.string(),
            date: z.string(),
            order: z.number(),
            subjectId: z.string(),
            topicId: z.string().nullable(),
            minutes: z.number(),
            kind: z.enum(["teoria", "questoes", "revisao"]),
            done: z.boolean(),
          }),
        ),
      })
      .nullable(),
    settings: z.record(z.unknown()),
  }),
});

export function buildBackup(data: AppData) {
  return { app: "FocusStudy", exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  const r = backupSchema.safeParse(json);
  if (!r.success) return { ok: false, error: "O arquivo não parece ser um backup do FocusStudy." };
  return { ok: true, data: r.data.data as unknown as AppData };
}

export function downloadFile(name: string, content: string | Blob, type = "application/json") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
