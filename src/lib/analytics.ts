import { addDays, dayKey, DAY_MS, fmt, startOfDay, startOfWeek } from "./dates";
import { priorityScore, subjectStats } from "./planner";
import { pendingReviews } from "./review";
import type { Session, Settings, Subject } from "./types";

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function accuracyOf(ss: Session[]): number | null {
  const q = ss.reduce((a, s) => a + s.questions, 0);
  if (!q) return null;
  return (ss.reduce((a, s) => a + s.correct, 0) / q) * 100;
}

export type Period = "madrugada" | "manha" | "tarde" | "noite";
export const PERIOD_LABEL: Record<Period, string> = {
  madrugada: "Madrugada",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};
const PERIOD_PHRASE: Record<Period, string> = {
  madrugada: "de madrugada",
  manha: "pela manhã",
  tarde: "à tarde",
  noite: "à noite",
};

export function periodOf(d: Date): Period {
  const h = d.getHours();
  if (h < 5) return "madrugada";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

/* ----------------------------- Dashboard ----------------------------- */

export interface Dashboard {
  weekMin: number;
  monthMin: number;
  totalMin: number;
  questions: number;
  accuracy: number | null;
  best: { name: string; accuracy: number } | null;
  attention: { name: string; score: number } | null;
  masteredTopics: number;
  totalTopics: number;
  pending: number;
  daysStudiedLast7: number;
  weeks: { label: string; days: number; minutes: number }[];
  concentration: { day: string; value: number }[];
  goal: { overall: number; hours: number; accuracy: number; topics: number };
}

export function dashboard(subjects: Subject[], sessions: Session[], settings: Settings, now: Date): Dashboard {
  const weekStart = startOfWeek(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let weekMin = 0;
  let monthMin = 0;
  let totalMin = 0;
  for (const s of sessions) {
    const t = new Date(s.startedAt).getTime();
    totalMin += s.studiedMin;
    if (t >= weekStart) weekMin += s.studiedMin;
    if (t >= monthStart) monthMin += s.studiedMin;
  }
  const questions = sessions.reduce((a, s) => a + s.questions, 0);
  const accuracy = accuracyOf(sessions);

  let best: Dashboard["best"] = null;
  let attention: Dashboard["attention"] = null;
  for (const subj of subjects) {
    const st = subjectStats(subj, sessions);
    if (st.accuracy !== null && st.questions >= 5 && (!best || st.accuracy > best.accuracy))
      best = { name: subj.name, accuracy: st.accuracy };
    const p = priorityScore(subj, st, now).score * (settings.adjustments[subj.id]?.factor ?? 1);
    if (!attention || p > attention.score) attention = { name: subj.name, score: p };
  }

  const allTopics = subjects.flatMap((s) => s.topics);
  const masteredTopics = allTopics.filter((t) => t.stage >= 3 && !t.flagged).length;

  const studiedDays = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))));
  let daysStudiedLast7 = 0;
  for (let i = 0; i < 7; i++) if (studiedDays.has(dayKey(addDays(now, -i)))) daysStudiedLast7++;

  const weeks: Dashboard["weeks"] = [];
  const ws = startOfWeek(now);
  for (let w = 3; w >= 0; w--) {
    const s = addDays(ws, -7 * w);
    let days = 0;
    let minutes = 0;
    for (let i = 0; i < 7; i++) if (studiedDays.has(dayKey(addDays(s, i)))) days++;
    const e = addDays(s, 7).getTime();
    for (const x of sessions) {
      const t = new Date(x.startedAt).getTime();
      if (t >= s.getTime() && t < e) minutes += x.studiedMin;
    }
    weeks.push({ label: w === 0 ? "Esta" : fmt(s, "dd/MM"), days, minutes });
  }

  const concentration = dailySeries(sessions, now, 14, (ss) =>
    ss.length ? avg(ss.map((s) => s.diary.focusQuality)) : null,
  );

  const hoursP = Math.min(1, totalMin / 60 / Math.max(1, settings.targetHours));
  const accP = accuracy === null ? 0 : Math.min(1, accuracy / Math.max(1, settings.targetAccuracy));
  const topicsP = allTopics.length ? masteredTopics / allTopics.length : 0;
  const overall = 0.4 * hoursP + 0.3 * accP + 0.3 * topicsP;

  return {
    weekMin,
    monthMin,
    totalMin,
    questions,
    accuracy,
    best,
    attention,
    masteredTopics,
    totalTopics: allTopics.length,
    pending: pendingReviews(subjects, now).length,
    daysStudiedLast7,
    weeks,
    concentration,
    goal: { overall, hours: hoursP, accuracy: accP, topics: topicsP },
  };
}

export function dailySeries(
  sessions: Session[],
  now: Date,
  days: number,
  fn: (ss: Session[]) => number | null,
): { day: string; value: number }[] {
  const out: { day: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i);
    const k = dayKey(d);
    const v = fn(sessions.filter((s) => dayKey(new Date(s.startedAt)) === k));
    if (v !== null) out.push({ day: fmt(d, "dd/MM"), value: +v.toFixed(1) });
  }
  return out;
}

/* ----------------------------- Insights ----------------------------- */

export interface Insight {
  text: string;
  n: number;
}

const MIN_GROUP = 2;

/** Observations (correlations, never causality) derived only from the user's own sessions. */
export function insights(subjects: Subject[], sessions: Session[]): Insight[] {
  const out: Insight[] = [];
  if (sessions.length < 4) return out;

  // Accuracy per subject by period of day.
  for (const subj of subjects) {
    const ss = sessions.filter((s) => s.subjectId === subj.id && s.questions > 0);
    const groups = groupBy(ss, (s) => periodOf(new Date(s.startedAt)));
    const rows = [...groups.entries()]
      .filter(([, g]) => g.length >= MIN_GROUP)
      .map(([p, g]) => ({ p, acc: accuracyOf(g) ?? 0, n: g.length }));
    if (rows.length < 2) continue;
    rows.sort((a, b) => b.acc - a.acc);
    const top = rows[0];
    const low = rows[rows.length - 1];
    if (top && low && top.acc - low.acc >= 10)
      out.push({
        text: `Seu percentual de acertos em ${subj.name} foi maior nas sessões realizadas ${PERIOD_PHRASE[top.p]} (${Math.round(top.acc)}%) do que ${PERIOD_PHRASE[low.p]} (${Math.round(low.acc)}%).`,
        n: top.n + low.n,
      });
  }

  // Sleep vs. start delay / concentration.
  const lowSleep = sessions.filter((s) => s.sleep <= 5);
  const goodSleep = sessions.filter((s) => s.sleep >= 7);
  if (lowSleep.length >= MIN_GROUP && goodSleep.length >= MIN_GROUP) {
    const dl = avg(lowSleep.map((s) => s.startDelayMin));
    const dg = avg(goodSleep.map((s) => s.startDelayMin));
    if (dl - dg >= 5 && dl >= dg * 1.3)
      out.push({
        text: `Você apresentou maior dificuldade para iniciar os estudos nos dias em que dormiu menos: em média ${Math.round(dl)} min para começar, contra ${Math.round(dg)} min quando o sono foi melhor.`,
        n: lowSleep.length + goodSleep.length,
      });
    const cl = avg(lowSleep.map((s) => s.diary.focusQuality));
    const cg = avg(goodSleep.map((s) => s.diary.focusQuality));
    if (cg - cl >= 1.5)
      out.push({
        text: `Nos dias com sono de melhor qualidade, sua concentração percebida foi em média ${cg.toFixed(1)}/10, contra ${cl.toFixed(1)}/10 nos dias de sono ruim.`,
        n: lowSleep.length + goodSleep.length,
      });
  }

  // Concentration by period.
  const byPeriod = [...groupBy(sessions, (s) => periodOf(new Date(s.startedAt))).entries()]
    .filter(([, g]) => g.length >= MIN_GROUP)
    .map(([p, g]) => ({ p, c: avg(g.map((s) => s.diary.focusQuality)), n: g.length }))
    .sort((a, b) => b.c - a.c);
  const bp = byPeriod[0];
  const wp = byPeriod[byPeriod.length - 1];
  if (byPeriod.length >= 2 && bp && wp && bp.c - wp.c >= 1.5)
    out.push({
      text: `Sua concentração percebida costuma ser maior nas sessões ${PERIOD_PHRASE[bp.p]} (${bp.c.toFixed(1)}/10) do que ${PERIOD_PHRASE[wp.p]} (${wp.c.toFixed(1)}/10).`,
      n: bp.n + wp.n,
    });

  // Interruptions vs accuracy.
  const withQ = sessions.filter((s) => s.questions > 0);
  const fewInt = withQ.filter((s) => s.interruptions <= 1);
  const manyInt = withQ.filter((s) => s.interruptions >= 3);
  if (fewInt.length >= MIN_GROUP && manyInt.length >= MIN_GROUP) {
    const a = accuracyOf(fewInt) ?? 0;
    const b = accuracyOf(manyInt) ?? 0;
    if (a - b >= 8)
      out.push({
        text: `Nas sessões com poucas interrupções seu percentual de acertos foi ${Math.round(a)}%, contra ${Math.round(b)}% nas sessões com 3 ou mais interrupções.`,
        n: fewInt.length + manyInt.length,
      });
  }

  // Anxiety vs concentration.
  const hiAnx = sessions.filter((s) => s.anxiety >= 7);
  const loAnx = sessions.filter((s) => s.anxiety <= 4);
  if (hiAnx.length >= MIN_GROUP && loAnx.length >= MIN_GROUP) {
    const a = avg(hiAnx.map((s) => s.diary.focusQuality));
    const b = avg(loAnx.map((s) => s.diary.focusQuality));
    if (b - a >= 1.5)
      out.push({
        text: `Nos registros com ansiedade ou inquietação elevada, a concentração percebida foi menor (${a.toFixed(1)}/10 contra ${b.toFixed(1)}/10).`,
        n: hiAnx.length + loAnx.length,
      });
  }

  // Session length vs. accuracy.
  const shortS = withQ.filter((s) => s.studiedMin <= 35);
  const longS = withQ.filter((s) => s.studiedMin >= 60);
  if (shortS.length >= MIN_GROUP && longS.length >= MIN_GROUP) {
    const a = accuracyOf(shortS) ?? 0;
    const b = accuracyOf(longS) ?? 0;
    if (Math.abs(a - b) >= 10)
      out.push({
        text:
          a > b
            ? `Seu percentual de acertos foi maior em sessões curtas (até 35 min): ${Math.round(a)}% contra ${Math.round(b)}% em sessões de 60 min ou mais.`
            : `Seu percentual de acertos foi maior em sessões longas (60 min ou mais): ${Math.round(b)}% contra ${Math.round(a)}% em sessões curtas.`,
        n: shortS.length + longS.length,
      });
  }
  return out;
}

function groupBy<T, K>(xs: T[], f: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = f(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/* ----------------------------- Charts ----------------------------- */

export function byHour(sessions: Session[]) {
  const rows: { hour: string; concentracao: number | null; acertos: number | null; n: number }[] = [];
  for (let h = 5; h <= 23; h++) {
    const ss = sessions.filter((s) => new Date(s.startedAt).getHours() === h);
    if (!ss.length) continue;
    const acc = accuracyOf(ss);
    rows.push({
      hour: `${h}h`,
      concentracao: +avg(ss.map((s) => s.diary.focusQuality)).toFixed(1),
      acertos: acc === null ? null : Math.round(acc),
      n: ss.length,
    });
  }
  return rows;
}

export function bySubject(subjects: Subject[], sessions: Session[]) {
  return subjects
    .map((s) => {
      const st = subjectStats(s, sessions);
      return {
        name: s.name.replace("Direito ", "D. ").replace("Legislação ", "Leg. "),
        acertos: st.accuracy === null ? 0 : Math.round(st.accuracy),
        horas: +(st.minutes / 60).toFixed(1),
        questoes: st.questions,
      };
    })
    .filter((r) => r.horas > 0 || r.questoes > 0);
}

export function sleepVsProductivity(sessions: Session[]) {
  return sessions.map((s) => ({
    sono: s.sleep,
    minutos: s.studiedMin,
    concentracao: s.diary.focusQuality,
  }));
}

export function lastSessions(subjects: Subject[], sessions: Session[], n = 10) {
  const name = new Map(subjects.map((s) => [s.id, s.name]));
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-n)
    .map((s) => ({
      label: fmt(s.startedAt, "dd/MM HH'h'"),
      materia: s.subjectId ? (name.get(s.subjectId) ?? "—") : "Livre",
      minutos: s.studiedMin,
      acertos: s.questions ? Math.round((s.correct / s.questions) * 100) : 0,
      concentracao: s.diary.focusQuality,
    }));
}

/* ----------------------------- Diário ----------------------------- */

export type ObstacleKey =
  | "iniciar"
  | "atencao"
  | "externa"
  | "pensamentos"
  | "memorizacao"
  | "compreensao"
  | "cansaco"
  | "concluir";

export const OBSTACLE_LABEL: Record<ObstacleKey, string> = {
  iniciar: "Dificuldade de iniciar tarefas",
  atencao: "Dificuldade de manter a atenção",
  externa: "Distração por estímulos externos",
  pensamentos: "Distração por pensamentos",
  memorizacao: "Dificuldade de memorização",
  compreensao: "Dificuldade de compreensão",
  cansaco: "Cansaço mental",
  concluir: "Dificuldade de concluir a atividade",
};

export const STRATEGIES: Record<ObstacleKey, string[]> = {
  iniciar: [
    "Divida a tarefa em etapas menores e use uma meta inicial de apenas cinco minutos.",
    "Deixe o material aberto e a primeira tarefa definida antes de começar.",
  ],
  atencao: [
    "Use blocos de estudo menores (25–30 min) com pausas programadas.",
    "Alterne leitura com questões para manter o engajamento.",
  ],
  externa: [
    "Estude em ambiente silencioso, com o celular afastado e notificações desligadas.",
    "Combine com as pessoas da casa horários sem interrupções.",
  ],
  pensamentos: [
    "Mantenha uma folha de “pensamentos para depois” e anote o que surgir sem interromper o estudo.",
    "Faça 1–2 minutos de respiração ou organização antes do bloco.",
  ],
  memorizacao: [
    "Priorize Active Recall: feche o material e tente explicar o conteúdo.",
    "Siga a revisão espaçada (24 h, 7, 15 e 30 dias) e use flashcards.",
  ],
  compreensao: [
    "Comece por uma visão geral do tema antes dos detalhes.",
    "Use exemplos, esquemas e questões comentadas para fixar o raciocínio.",
  ],
  cansaco: [
    "Coloque os conteúdos mais exigentes no horário em que você rende mais.",
    "Faça pausas reais (levantar, beber água) e cuide da rotina de sono.",
  ],
  concluir: [
    "Defina um critério de conclusão claro (ex.: 20 questões ou 1 tópico).",
    "Registre pequenos avanços para manter o ritmo até o fim.",
  ],
};

export function obstacleScores(s: Session): Record<ObstacleKey, number> {
  const d = s.diary;
  const dist = Math.min(10, d.distractions * 1.5);
  return {
    iniciar: 10 - d.easeStart,
    atencao: 10 - d.attention,
    externa: d.source === "externa" || d.source === "ambos" ? dist : 0,
    pensamentos: d.source === "pensamentos" || d.source === "ambos" ? dist : 0,
    memorizacao: 10 - d.recall,
    compreensao: 10 - d.comprehension,
    cansaco: (s.fatigue + (10 - d.energy)) / 2,
    concluir: d.finishDifficulty,
  };
}

export interface WeeklyReport {
  sessions: number;
  scores: { key: ObstacleKey; label: string; value: number; previous: number | null }[];
  main: ObstacleKey[];
}

export function weeklyReport(sessions: Session[], now: Date): WeeklyReport {
  const since = now.getTime() - 7 * DAY_MS;
  const prevSince = since - 7 * DAY_MS;
  const cur = sessions.filter((s) => new Date(s.startedAt).getTime() >= since);
  const prev = sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t >= prevSince && t < since;
  });
  const keys = Object.keys(OBSTACLE_LABEL) as ObstacleKey[];
  const curScores = cur.map(obstacleScores);
  const prevScores = prev.map(obstacleScores);
  const scores = keys
    .map((key) => ({
      key,
      label: OBSTACLE_LABEL[key],
      value: +avg(curScores.map((x) => x[key])).toFixed(1),
      previous: prevScores.length ? +avg(prevScores.map((x) => x[key])).toFixed(1) : null,
    }))
    .sort((a, b) => b.value - a.value);
  const main = cur.length ? scores.filter((s) => s.value >= 4).slice(0, 3).map((s) => s.key) : [];
  return { sessions: cur.length, scores, main };
}
