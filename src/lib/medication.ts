import type { Dose, MedProfile } from "./types";

export type PhaseKey = "aguardando" | "inicio" | "pico" | "declinio" | "encerrado";

export const PHASE_LABEL: Record<PhaseKey, string> = {
  aguardando: "Antes do início estimado",
  inicio: "Início estimado do efeito",
  pico: "Período de pico estimado",
  declinio: "Redução gradual estimada",
  encerrado: "Fim do período estimado",
};

export const PHASE_HINT: Record<PhaseKey, string> = {
  aguardando: "Bom momento para organizar o material e escolher a primeira tarefa.",
  inicio: "Comece por tarefas de aquecimento: leitura leve ou revisão rápida.",
  pico: "Janela estimada para conteúdos mais exigentes ou questões novas.",
  declinio: "Prefira revisões, flashcards e tarefas mais mecânicas.",
  encerrado: "Use para revisão leve, organização ou descanso.",
};

export interface DoseWindows {
  dose: Date;
  onset: Date;
  peakStart: Date;
  peakEnd: Date;
  end: Date;
}

export function doseWindows(takenAt: Date, p: MedProfile): DoseWindows {
  const t = takenAt.getTime();
  const m = (min: number) => new Date(t + min * 60_000);
  return {
    dose: takenAt,
    onset: m(p.onsetMin),
    peakStart: m(p.peakStartMin),
    peakEnd: m(p.peakEndMin),
    end: m(p.durationMin),
  };
}

export interface PhaseInfo {
  key: PhaseKey;
  label: string;
  windows: DoseWindows;
  nextAt: Date | null;
  nextKey: PhaseKey | null;
  /** 0–1 progress through the whole estimated duration. */
  progress: number;
}

export function phaseAt(takenAt: Date, p: MedProfile, now: Date): PhaseInfo {
  const w = doseWindows(takenAt, p);
  const n = now.getTime();
  let key: PhaseKey;
  let nextAt: Date | null;
  let nextKey: PhaseKey | null;
  if (n < w.onset.getTime()) {
    key = "aguardando";
    nextAt = w.onset;
    nextKey = "inicio";
  } else if (n < w.peakStart.getTime()) {
    key = "inicio";
    nextAt = w.peakStart;
    nextKey = "pico";
  } else if (n < w.peakEnd.getTime()) {
    key = "pico";
    nextAt = w.peakEnd;
    nextKey = "declinio";
  } else if (n < w.end.getTime()) {
    key = "declinio";
    nextAt = w.end;
    nextKey = "encerrado";
  } else {
    key = "encerrado";
    nextAt = null;
    nextKey = null;
  }
  const total = w.end.getTime() - takenAt.getTime();
  const progress = total > 0 ? Math.min(1, Math.max(0, (n - takenAt.getTime()) / total)) : 1;
  return { key, label: PHASE_LABEL[key], windows: w, nextAt, nextKey, progress };
}

/** Most relevant dose right now: latest one still within its estimated duration, else the latest of today. */
export function currentDose(doses: Dose[], p: MedProfile, now: Date): Dose | null {
  const sorted = [...doses].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const active = sorted.find((d) => {
    const t = new Date(d.takenAt).getTime();
    return t <= now.getTime() && now.getTime() < t + p.durationMin * 60_000;
  });
  if (active) return active;
  const today = sorted.find((d) => new Date(d.takenAt).toDateString() === now.toDateString());
  return today ?? null;
}

export function validateProfile(p: Pick<MedProfile, "onsetMin" | "peakStartMin" | "peakEndMin" | "durationMin">): string | null {
  if (p.onsetMin < 0) return "O início estimado não pode ser negativo.";
  if (p.peakStartMin < p.onsetMin) return "O pico deve começar depois do início.";
  if (p.peakEndMin < p.peakStartMin) return "O fim do pico deve ser depois do começo do pico.";
  if (p.durationMin < p.peakEndMin) return "A duração total deve ser maior que o fim do pico.";
  return null;
}
