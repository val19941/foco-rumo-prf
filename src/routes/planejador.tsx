import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Play, RefreshCw, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/ConfirmReplace";
import { Bar, Empty, NumberField, PageHeader, Panel } from "@/components/app/kit";
import { dayKey, fmt, fmtHours, fmtMinutes, parseDayKey, startOfDay, uid, WEEKDAYS_SHORT } from "@/lib/dates";
import { generateWeekPlan, KIND_LABEL, priorityScore, subjectStats } from "@/lib/planner";
import { pendingReviews } from "@/lib/review";
import { useApp } from "@/lib/store";
import type { PlanBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planejador")({
  head: () => ({
    meta: [
      { title: "Planejador inteligente — FocusStudy" },
      { name: "description", content: "Cronograma semanal gerado por prioridade, distribuindo as disciplinas da PRF sem concentrar em uma só." },
      { property: "og:title", content: "Planejador inteligente — FocusStudy" },
      { property: "og:description", content: "Distribuição automática das disciplinas ao longo da semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const settings = useApp((s) => s.settings);
  const plan = useApp((s) => s.plan);
  const setPlan = useApp((s) => s.setPlan);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const setSettings = useApp((s) => s.setSettings);
  const planStudy = useApp((s) => s.planStudy);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const today = dayKey(new Date());
  const days = plan ? [...new Set(plan.blocks.map((b) => b.date))].sort() : [];
  const [sel, setSel] = useState<string>(today);
  const selected = days.includes(sel) ? sel : (days[0] ?? today);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const pend = pendingReviews(subjects, new Date()).length;

  const build = (): PlanBlock[] =>
    generateWeekPlan({
      subjects,
      sessions,
      settings,
      adjustments: settings.adjustments,
      start: startOfDay(new Date()),
      now: new Date(),
      idFactory: uid,
    });

  const apply = () => {
    const blocks = build();
    if (!blocks.length) {
      toast.error("Sem tempo disponível", { description: "Defina sua disponibilidade diária abaixo." });
      return;
    }
    setPlan({ generatedAt: new Date().toISOString(), startDate: today, blocks });
    setSel(today);
    toast.success("Cronograma gerado", { description: `${blocks.length} blocos distribuídos em 7 dias.` });
  };

  const ranking = useMemo(
    () =>
      subjects
        .map((s) => ({ s, p: priorityScore(s, subjectStats(s, sessions), new Date()) }))
        .map((x) => ({ ...x, final: x.p.score * (settings.adjustments[x.s.id]?.factor ?? 1) }))
        .sort((a, b) => b.final - a.final),
    [subjects, sessions, settings.adjustments],
  );

  const distribution = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of plan?.blocks ?? []) m.set(b.subjectId, (m.get(b.subjectId) ?? 0) + b.minutes);
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, min]) => ({ id, min, share: total ? min / total : 0 }));
  }, [plan]);

  const dayBlocks = plan?.blocks.filter((b) => b.date === selected).sort((a, b) => a.order - b.order) ?? [];
  const weekTotal = settings.availability.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planejador"
        subtitle={plan ? `Gerado em ${fmt(plan.generatedAt, "dd/MM 'às' HH:mm")}` : "Distribuição automática por prioridade."}
        action={
          <Button className="rounded-xl" onClick={() => (plan ? setConfirm(true) : apply())}>
            {plan ? <RefreshCw /> : <Wand2 />} {plan ? "Refazer" : "Gerar"}
          </Button>
        }
      />

      {pend > 0 ? (
        <Link to="/revisoes" className="block rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground">
          Você tem {pend} revisão(ões) para hoje — faça-as antes dos blocos novos.
        </Link>
      ) : null}

      {plan ? (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {days.map((k) => {
              const d = parseDayKey(k);
              const bs = plan.blocks.filter((b) => b.date === k);
              const done = bs.filter((b) => b.done).length;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSel(k)}
                  className={cn(
                    "flex min-w-16 flex-col items-center rounded-2xl border px-3 py-2",
                    k === selected ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
                  )}
                >
                  <span className="text-[11px] font-medium opacity-80">{k === today ? "Hoje" : WEEKDAYS_SHORT[d.getDay()]}</span>
                  <span className="font-display text-lg font-bold">{fmt(d, "dd")}</span>
                  <span className="text-[10px] opacity-80">{done}/{bs.length}</span>
                </button>
              );
            })}
          </div>

          <Panel title={fmt(parseDayKey(selected), "EEEE, dd/MM")}>
            {dayBlocks.length ? (
              <ul className="space-y-2">
                {dayBlocks.map((b, i) => {
                  const s = byId.get(b.subjectId);
                  const t = s?.topics.find((x) => x.id === b.topicId);
                  return (
                    <li key={b.id} className={cn("flex items-center gap-3 rounded-xl border p-3", b.done && "bg-muted/60")}>
                      <button
                        type="button"
                        aria-label={b.done ? "Desmarcar bloco" : "Marcar como feito"}
                        onClick={() => toggleBlock(b.id)}
                        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", b.done ? "border-success bg-success text-success-foreground" : "border-input")}
                      >
                        {b.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-semibold", b.done && "line-through opacity-60")}>{s?.name ?? "Disciplina removida"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className={cn("mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold", b.kind === "questoes" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground")}>{KIND_LABEL[b.kind]}</span>
                          {fmtMinutes(b.minutes)}{t ? ` · ${t.name}` : ""}
                        </p>
                      </div>
                      {!b.done ? (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="rounded-xl"
                          aria-label="Estudar este bloco"
                          onClick={() => {
                            planStudy({ subjectId: b.subjectId, topicId: b.topicId, kind: b.kind, blockId: b.id, minutes: b.minutes });
                            void navigate({ to: "/estudar" });
                          }}
                        >
                          <Play />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Dia sem blocos (disponibilidade zero).</p>
            )}
          </Panel>

          <Panel title="Distribuição da semana">
            <ul className="space-y-2.5">
              {distribution.map((d) => (
                <li key={d.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{byId.get(d.id)?.name ?? "—"}</span>
                    <span className="tabular text-muted-foreground">{fmtMinutes(d.min)} · {Math.round(d.share * 100)}%</span>
                  </div>
                  <Bar value={d.share / Math.max(0.01, distribution[0]?.share ?? 1)} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Nenhuma disciplina passa de 25% da semana, e o planejador evita repetir a mesma disciplina em blocos seguidos.</p>
          </Panel>
        </>
      ) : (
        <Empty
          title="Nenhum cronograma ainda"
          text="O planejador usa importância no edital, dificuldade, acertos, tempo desde a última revisão e domínio declarado."
          action={<Button className="rounded-xl" onClick={apply}><Wand2 /> Gerar cronograma da semana</Button>}
        />
      )}

      <Panel title="Ordem de prioridade" action={<Link to="/prf" className="text-xs font-medium text-primary">Editar disciplinas</Link>}>
        <ol className="space-y-2">
          {ranking.map(({ s, final, p }, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="w-5 text-right font-display text-sm font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="tabular text-muted-foreground">{Math.round(final * 100)}</span>
                </div>
                <Bar value={final} className={i < 3 ? "bg-highlight" : undefined} />
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Peso {s.importance}/5 · dificuldade {s.difficulty}/5 · domínio {s.mastery}/10 · erros {Math.round(p.accuracy * 100)}% · tempo sem revisar {Math.round(p.recency * 100)}%
                  {settings.adjustments[s.id] ? ` · ajuste ×${settings.adjustments[s.id]?.factor}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Disponibilidade diária" action={<span className="text-xs tabular text-muted-foreground">{fmtHours(weekTotal)}/semana</span>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <NumberField
              key={wd}
              label={WEEKDAYS_SHORT[wd] ?? ""}
              suffix="min"
              step={30}
              max={900}
              value={settings.availability[wd] ?? 0}
              onChange={(v) => {
                const next = [...settings.availability];
                next[wd] = v;
                setSettings({ availability: next });
              }}
            />
          ))}
          <NumberField label="Bloco" suffix="min" step={5} min={15} max={120} value={settings.blockMin} onChange={(v) => setSettings({ blockMin: v })} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Alterações valem para o próximo cronograma gerado.</p>
      </Panel>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Substituir o cronograma atual?"
        description="O planejamento existente, incluindo blocos marcados como feitos, será trocado por uma nova distribuição para os próximos 7 dias a partir de hoje."
        confirmLabel="Substituir"
        onConfirm={apply}
      />
    </div>
  );
}

