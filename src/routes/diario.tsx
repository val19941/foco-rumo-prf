import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Lightbulb, Minus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Bar, Empty, Notice, PageHeader, Panel } from "@/components/app/kit";
import { OBSTACLE_LABEL, obstacleScores, STRATEGIES, weeklyReport } from "@/lib/analytics";
import { fmt } from "@/lib/dates";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário de Concentração — FocusStudy" },
      { name: "description", content: "Identifique sua principal dificuldade nos estudos e receba estratégias educacionais para superá-la." },
      { property: "og:title", content: "Diário de Concentração — FocusStudy" },
      { property: "og:description", content: "Relatório semanal dos seus principais obstáculos de concentração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiaryPage,
});

function DiaryPage() {
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const report = useMemo(() => weeklyReport(sessions, new Date()), [sessions]);
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const recent = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);

  return (
    <div className="space-y-5">
      <PageHeader title="Diário de Concentração" subtitle="Relatório dos últimos 7 dias, a partir das respostas ao final de cada sessão." />

      {report.sessions === 0 ? (
        <Empty
          title="Sem registros nesta semana"
          text="Ao finalizar uma sessão no modo estudo, responda às 8 perguntas rápidas. O relatório aparece aqui."
          action={<Button asChild className="rounded-xl"><Link to="/estudar">Iniciar sessão</Link></Button>}
        />
      ) : (
        <>
          <Panel title="Principais obstáculos da semana" action={<span className="text-xs text-muted-foreground">{report.sessions} sessão(ões)</span>}>
            {report.main.length ? (
              <div className="space-y-4">
                {report.main.map((k, i) => (
                  <div key={k} className={cn("rounded-2xl p-4", i === 0 ? "bg-accent" : "bg-muted")}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i === 0 ? "Principal dificuldade" : `${i + 1}º obstáculo`}</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-foreground">{OBSTACLE_LABEL[k]}</p>
                    <ul className="mt-2 space-y-1.5">
                      {STRATEGIES[k].map((s) => (
                        <li key={s} className="flex gap-2 text-sm text-foreground">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-highlight" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum indicador chegou a 6/10 nesta semana. Continue registrando!</p>
            )}
          </Panel>

          <Panel title="Indicadores (0 = sem dificuldade, 10 = muita)">
            <ul className="space-y-3">
              {report.scores.map((s) => {
                const diff = s.previous === null ? null : s.value - s.previous;
                return (
                  <li key={s.key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="flex items-center gap-1.5 tabular">
                        {diff !== null ? (
                          <span className={cn("flex items-center text-xs", diff > 0.5 ? "text-destructive" : diff < -0.5 ? "text-success" : "text-muted-foreground")}>
                            {diff > 0.5 ? <ArrowUp className="h-3 w-3" /> : diff < -0.5 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {Math.abs(diff).toFixed(1)}
                          </span>
                        ) : null}
                        <span className="font-semibold">{s.value}</span>
                      </span>
                    </div>
                    <Bar value={s.value / 10} className={s.value >= 6 ? "bg-highlight" : undefined} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Setas comparam com a semana anterior.</p>
          </Panel>
        </>
      )}

      <Panel title="Registros recentes">
        {recent.length ? (
          <ul className="divide-y">
            {recent.map((s) => {
              const sc = obstacleScores(s);
              const top = (Object.keys(sc) as (keyof typeof sc)[]).sort((a, b) => sc[b] - sc[a])[0];
              return (
                <li key={s.id} className="py-2.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-semibold">{s.subjectId ? (names.get(s.subjectId) ?? "—") : "Estudo livre"}</span>
                    <span className="text-xs tabular text-muted-foreground">{fmt(s.startedAt, "dd/MM HH:mm")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Concentração {s.diary.focusQuality}/10 · energia {s.diary.energy}/10 · {s.diary.distractions} distração(ões)
                    {top && sc[top] >= 6 ? ` · maior dificuldade: ${OBSTACLE_LABEL[top].toLowerCase()}` : ""}
                  </p>
                  {s.notes ? <p className="mt-0.5 text-xs italic text-muted-foreground">“{s.notes}”</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        )}
      </Panel>
      <Notice>As estratégias são sugestões educacionais de organização dos estudos e não substituem acompanhamento profissional.</Notice>
    </div>
  );
}
