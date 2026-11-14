import { DAY_MS, endOfDay } from "./dates";
import { accuracyOf, OBSTACLE_LABEL, weeklyReport } from "./analytics";
import { priorityScore, subjectStats } from "./planner";
import type { Focus, ID, Session, Settings, Subject } from "./types";

export type AdvisorAction =
  | { type: "adjust"; subjectId: ID; factor: number; focus: Focus }
  | { type: "redistribute"; subjectId: ID }
  | { type: "blockMin"; value: number };

export interface Recommendation {
  id: string;
  tipo: "desempenho" | "revisao" | "concentracao" | "cronograma" | "dominio";
  titulo: string;
  texto: string;
  action: AdvisorAction | null;
}

function windowAcc(ss: Session[], from: number, to: number) {
  return accuracyOf(
    ss.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= from && t < to;
    }),
  );
}

/** Rule-based recommendations computed entirely on the device. */
export function localRecommendations(
  subjects: Subject[],
  sessions: Session[],
  settings: Settings,
  now: Date,
): Recommendation[] {
  const out: Recommendation[] = [];
  const overall = accuracyOf(sessions);
  const t = now.getTime();
  const limit = endOfDay(now).getTime();

  for (const s of subjects) {
    const ss = sessions.filter((x) => x.subjectId === s.id);
    const st = subjectStats(s, sessions);
    const thisWeek = windowAcc(ss, t - 7 * DAY_MS, t + 1);
    const lastWeek = windowAcc(ss, t - 14 * DAY_MS, t - 7 * DAY_MS);
    if (thisWeek !== null && lastWeek !== null && lastWeek - thisWeek >= 10) {
      out.push({
        id: `drop-${s.id}`,
        tipo: "desempenho",
        titulo: `Queda em ${s.name}`,
        texto: `Seu desempenho em ${s.name} caiu nesta semana (${Math.round(thisWeek)}% contra ${Math.round(lastWeek)}% na anterior). Recomendo aumentar a quantidade de exercícios dessa disciplina.`,
        action: { type: "adjust", subjectId: s.id, factor: 1.3, focus: "pratica" },
      });
    } else if (overall !== null && st.accuracy !== null && st.questions >= 10 && overall - st.accuracy >= 10) {
      out.push({
        id: `below-${s.id}`,
        tipo: "desempenho",
        titulo: `${s.name} abaixo da sua média`,
        texto: `Seu aproveitamento em questões de ${s.name} (${Math.round(st.accuracy)}%) está abaixo da sua média (${Math.round(overall)}%). Priorize a revisão dos assuntos com maior índice de erros.`,
        action: { type: "adjust", subjectId: s.id, factor: 1.4, focus: "equilibrado" },
      });
    }

    if (s.mastery >= 8 && st.accuracy !== null && st.accuracy >= 80 && st.questions >= 10) {
      out.push({
        id: `mastery-${s.id}`,
        tipo: "dominio",
        titulo: `Bom domínio em ${s.name}`,
        texto: `Você apresenta bom domínio de ${s.name}. Podemos reduzir o tempo dedicado à teoria e aumentar a prática com questões.`,
        action: { type: "adjust", subjectId: s.id, factor: 0.8, focus: "pratica" },
      });
    }

    const pending = s.topics.filter((x) => x.nextReview && new Date(x.nextReview).getTime() <= limit).length;
    if (pending >= 3) {
      out.push({
        id: `pending-${s.id}`,
        tipo: "revisao",
        titulo: `Revisões acumuladas em ${s.name}`,
        texto: `Você acumulou ${pending} revisões pendentes de ${s.name}. Vamos redistribuí-las nos próximos dias (até 2 por dia).`,
        action: { type: "redistribute", subjectId: s.id },
      });
    }

    const days = st.lastReview ? (t - st.lastReview.getTime()) / DAY_MS : Infinity;
    if (s.importance >= 4 && days >= 10 && sessions.length >= 3) {
      out.push({
        id: `stale-${s.id}`,
        tipo: "cronograma",
        titulo: `${s.name} sem estudo recente`,
        texto: Number.isFinite(days)
          ? `Faz ${Math.floor(days)} dias que você não estuda ${s.name}, uma disciplina de peso alto no edital. Sugiro incluí-la com mais frequência nesta semana.`
          : `Você ainda não registrou estudos em ${s.name}, uma disciplina de peso alto no edital. Sugiro incluí-la com mais frequência nesta semana.`,
        action: { type: "adjust", subjectId: s.id, factor: 1.25, focus: "teoria" },
      });
    }
  }

  const report = weeklyReport(sessions, now);
  const attention = report.scores.find((x) => x.key === "atencao");
  if (report.sessions >= 3 && attention && attention.value >= 6 && settings.blockMin > 30) {
    out.push({
      id: "block-size",
      tipo: "concentracao",
      titulo: "Blocos de estudo menores",
      texto: `Nesta semana a ${OBSTACLE_LABEL.atencao.toLowerCase()} apareceu com intensidade ${attention.value}/10. Blocos de 30 minutos com pausas programadas podem facilitar a manutenção do foco.`,
      action: { type: "blockMin", value: 30 },
    });
  }

  const weekMin = sessions
    .filter((s) => new Date(s.startedAt).getTime() >= t - 7 * DAY_MS)
    .reduce((a, s) => a + s.studiedMin, 0);
  const goal = settings.weeklyHoursGoal * 60;
  if (sessions.length >= 3 && weekMin < goal * 0.6) {
    out.push({
      id: "weekly-goal",
      tipo: "cronograma",
      titulo: "Meta semanal distante",
      texto: `Nos últimos 7 dias você estudou ${(weekMin / 60).toFixed(1)} h de uma meta de ${settings.weeklyHoursGoal} h. Considere blocos menores e mais frequentes, em vez de sessões longas e raras.`,
      action: null,
    });
  }
  return out;
}

/** Aggregated, de-identified summary sent to the AI. Contains no medication or health data. */
export function buildAdvisorSummary(subjects: Subject[], sessions: Session[], settings: Settings, now: Date) {
  const t = now.getTime();
  const limit = endOfDay(now).getTime();
  const weekly = weeklyReport(sessions, now);
  return {
    disciplinas: subjects.map((s) => {
      const ss = sessions.filter((x) => x.subjectId === s.id);
      const st = subjectStats(s, sessions);
      return {
        id: s.id,
        nome: s.name,
        importancia: s.importance,
        dificuldade: s.difficulty,
        dominioDeclarado: s.mastery,
        prioridadeCalculada: +priorityScore(s, st, now).score.toFixed(2),
        questoes: st.questions,
        acertoPct: st.accuracy === null ? null : Math.round(st.accuracy),
        acertoSemanaPct: round(windowAcc(ss, t - 7 * DAY_MS, t + 1)),
        acertoSemanaAnteriorPct: round(windowAcc(ss, t - 14 * DAY_MS, t - 7 * DAY_MS)),
        minutosTotal: st.minutes,
        diasDesdeUltimoEstudo: st.lastReview ? Math.floor((t - st.lastReview.getTime()) / DAY_MS) : null,
        revisoesPendentes: s.topics.filter((x) => x.nextReview && new Date(x.nextReview).getTime() <= limit).length,
        topicosComErros: s.topics.filter((x) => x.flagged).map((x) => x.name),
        topicosNaoIniciados: s.topics.filter((x) => !x.learnedAt).length,
      };
    }),
    geral: {
      acertoMedioPct: round(accuracyOf(sessions)),
      sessoesRegistradas: sessions.length,
      minutosUltimos7Dias: sessions
        .filter((s) => new Date(s.startedAt).getTime() >= t - 7 * DAY_MS)
        .reduce((a, s) => a + s.studiedMin, 0),
      metaSemanalHoras: settings.weeklyHoursGoal,
      disponibilidadeMinutosPorDia: settings.availability,
      duracaoBlocoMin: settings.blockMin,
    },
    concentracaoSemana: {
      sessoes: weekly.sessions,
      indicadores: weekly.scores.map((s) => ({ indicador: s.label, intensidade0a10: s.value })),
    },
  };
}

function round(n: number | null) {
  return n === null ? null : Math.round(n);
}

const MED_TERMS = /(dose|dosagem|miligram|\bmg\b|medica[çc][ãa]o|medicamento|rem[ée]dio|ritalina|metilfenidato|posologia|comprimido)/i;

/** Safety filter: drops any AI text that touches medication. */
export function mentionsMedication(text: string): boolean {
  return MED_TERMS.test(text);
}
