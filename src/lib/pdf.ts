import { jsPDF } from "jspdf";
import { dashboard, insights, OBSTACLE_LABEL, STRATEGIES, weeklyReport } from "./analytics";
import { fmt, fmtHours, fmtMinutes } from "./dates";
import { KIND_LABEL, priorityScore, subjectStats } from "./planner";
import { pendingReviews } from "./review";
import type { AppData } from "./types";

/** Builds a performance report PDF. Medication records are not included. */
export function buildReportPdf(data: AppData, now: Date): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;
  let y = 18;

  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 18;
    }
  };
  const h1 = (t: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 90, 100);
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(200, 215, 215);
    doc.line(M, y, W - M, y);
    y += 6;
    doc.setTextColor(40, 40, 50);
  };
  const p = (t: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(t, W - 2 * M) as string[];
    ensure(lines.length * (size * 0.45) + 2);
    doc.text(lines, M, y);
    y += lines.length * (size * 0.45) + 2;
  };
  const row = (cols: string[], widths: number[], bold = false) => {
    ensure(6);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    let x = M;
    cols.forEach((c, i) => {
      const w = widths[i] ?? 20;
      doc.text(doc.splitTextToSize(c, w - 1)[0] ?? "", x, y);
      x += w;
    });
    y += 5;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 90, 100);
  doc.text("FocusStudy — Relatório de Desempenho", M, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 120);
  doc.text(`Gerado em ${fmt(now, "dd 'de' MMMM 'de' yyyy, HH:mm")} · Preparação PRF`, M, y);
  y += 10;
  doc.setTextColor(40, 40, 50);

  const d = dashboard(data.subjects, data.sessions, data.settings, now);
  h1("Painel de evolução");
  p(`Horas na semana: ${fmtHours(d.weekMin)}   ·   Horas no mês: ${fmtHours(d.monthMin)}   ·   Total: ${fmtHours(d.totalMin)}`);
  p(`Questões resolvidas: ${d.questions}   ·   Acerto geral: ${d.accuracy === null ? "—" : Math.round(d.accuracy) + "%"}`);
  p(`Melhor desempenho: ${d.best ? `${d.best.name} (${Math.round(d.best.accuracy)}%)` : "—"}   ·   Precisa de atenção: ${d.attention?.name ?? "—"}`);
  p(`Conteúdos dominados: ${d.masteredTopics}/${d.totalTopics}   ·   Revisões pendentes: ${d.pending}   ·   Dias estudados (7 dias): ${d.daysStudiedLast7}/7`);
  p(`Progresso estimado até a meta: ${Math.round(d.goal.overall * 100)}% (indicador interno, não é previsão de aprovação).`);

  h1("Disciplinas");
  const widths = [58, 16, 18, 18, 22, 26, 20];
  row(["Disciplina", "Domínio", "Questões", "Acertos", "Tempo", "Última revisão", "Prioridade"], widths, true);
  for (const s of data.subjects) {
    const st = subjectStats(s, data.sessions);
    row(
      [
        s.name,
        `${s.mastery}/10`,
        String(st.questions),
        st.accuracy === null ? "—" : `${Math.round(st.accuracy)}%`,
        fmtMinutes(st.minutes),
        st.lastReview ? fmt(st.lastReview, "dd/MM/yy") : "—",
        `${Math.round(priorityScore(s, st, now).score * 100)}`,
      ],
      widths,
    );
  }

  const rep = weeklyReport(data.sessions, now);
  h1("Diário de concentração — últimos 7 dias");
  if (!rep.sessions) p("Sem registros de diário nos últimos 7 dias.");
  else {
    p(`${rep.sessions} sessão(ões) registradas.`);
    for (const s of rep.scores) p(`${s.label}: ${s.value}/10`, 9);
    if (rep.main.length) {
      y += 2;
      p("Principais obstáculos e estratégias sugeridas", 10, true);
      for (const k of rep.main) {
        p(OBSTACLE_LABEL[k], 9.5, true);
        for (const st of STRATEGIES[k]) p(`• ${st}`, 9);
      }
    }
  }

  const ins = insights(data.subjects, data.sessions);
  h1("Observações sobre seus registros");
  if (!ins.length) p("Ainda não há dados suficientes para identificar padrões.");
  for (const i of ins) p(`• ${i.text} (${i.n} sessões)`, 9.5);
  p("Observações indicam correlações nos seus próprios registros, não relações de causa.", 8);

  const pend = pendingReviews(data.subjects, now);
  h1("Revisões pendentes");
  if (!pend.length) p("Nenhuma revisão pendente.");
  for (const r of pend.slice(0, 30)) p(`• ${r.subject.name} — ${r.topic.name}${r.topic.flagged ? " (prioritária)" : ""}`, 9);

  h1("Últimas sessões");
  const sw = [28, 54, 20, 18, 22, 20];
  row(["Data", "Disciplina", "Tipo", "Tempo", "Questões", "Concentr."], sw, true);
  const names = new Map(data.subjects.map((s) => [s.id, s.name]));
  for (const s of [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 25)) {
    row(
      [
        fmt(s.startedAt, "dd/MM HH:mm"),
        s.subjectId ? (names.get(s.subjectId) ?? "—") : "Livre",
        KIND_LABEL[s.kind],
        fmtMinutes(s.studiedMin),
        s.questions ? `${s.correct}/${s.questions}` : "—",
        `${s.diary.focusQuality}/10`,
      ],
      sw,
    );
  }

  y += 4;
  p("Relatório gerado a partir dos dados registrados no dispositivo. Não contém registros de medicação e não constitui orientação médica.", 8);
  return doc.output("blob");
}
