import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, BookCheck, CalendarCheck, Clock, Flame, Play, Repeat, Target, TrendingUp, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Empty, Panel, Ring, Stat } from "@/components/app/kit";
import { MedStatus } from "@/components/app/MedStatus";
import { dashboard } from "@/lib/analytics";
import { daysBetween, dayKey, fmt, fmtHours, fmtMinutes, pct } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/planner";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — FocusStudy" },
      { name: "description", content: "Sua visão geral: horas estudadas, acertos, revisões pendentes e progresso até a aprovação na PRF." },
      { property: "og:title", content: "Painel — FocusStudy" },
      { property: "og:description", content: "Horas, acertos, revisões e progresso até a meta de aprovação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const settings = useApp((s) => s.settings);
  const plan = useApp((s) => s.plan);
  const planStudy = useApp((s) => s.planStudy);
  const navigate = useNavigate();
  const now = new Date();
  const d = useMemo(() => dashboard(subjects, sessions, settings, new Date()), [subjects, sessions, settings]);
  const today = dayKey(now);
  const todayBlocks = plan?.blocks.filter((b) => b.date === today) ?? [];
  const names = new Map(subjects.map((s) => [s.id, s]));
  const examDays = settings.examDate ? daysBetween(now, new Date(settings.examDate)) : null;
  const hour = now.getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-hero p-5 text-primary-foreground shadow-float sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm opacity-85">{fmt(now, "EEEE, d 'de' MMMM")}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{greet}! Rumo à PRF.</h1>
            <p className="mt-2 max-w-md text-sm opacity-90">
              {examDays !== null && examDays >= 0
                ? `Faltam ${examDays} dias para a prova.`
                : `${fmtHours(d.totalMin)} estudadas até agora de uma meta de ${settings.targetHours} h.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/estudar"><Play /> Estudar agora</Link>
              </Button>
              {d.pending > 0 ? (
                <Button asChild variant="outline" className="rounded-xl border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Link to="/revisoes"><Repeat /> {d.pending} revisões</Link>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="rounded-full bg-primary-foreground/10 p-1.5">
            <Ring value={d.goal.overall} size={104} stroke={10}>
              <span className="font-display text-2xl font-bold">{Math.round(d.goal.overall * 100)}%</span>
              <span className="text-[10px] opacity-85">da meta</span>
            </Ring>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
          {[
            ["Horas", d.goal.hours],
            ["Acertos", d.goal.accuracy],
            ["Conteúdos", d.goal.topics],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="flex justify-between opacity-90"><span>{l}</span><span className="tabular">{Math.round((v as number) * 100)}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
                <div className="h-full rounded-full bg-highlight" style={{ width: `${(v as number) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <MedStatus compact />
        <Panel title="Plano de hoje" action={<Link to="/planejador" className="text-xs font-medium text-primary">Ver semana</Link>}>
          {todayBlocks.length ? (
            <ul className="space-y-2">
              {todayBlocks.map((b) => {
                const s = names.get(b.subjectId);
                const t = s?.topics.find((x) => x.id === b.topicId);
                return (
                  <li key={b.id} className={cn("flex items-center gap-3 rounded-xl border p-2.5", b.done && "opacity-55")}>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold", b.done && "line-through")}>{s?.name ?? "Disciplina removida"}</p>
                      <p className="truncate text-xs text-muted-foreground">{KIND_LABEL[b.kind]} · {fmtMinutes(b.minutes)}{t ? ` · ${t.name}` : ""}</p>
                    </div>
                    {!b.done ? (
                      <Button
                        size="icon"
                        className="rounded-xl"
                        aria-label="Iniciar bloco"
                        onClick={() => {
                          planStudy({ subjectId: b.subjectId, topicId: b.topicId, kind: b.kind, blockId: b.id, minutes: b.minutes });
                          void navigate({ to: "/estudar" });
                        }}
                      >
                        <Play />
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-success">Feito</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="Nenhum bloco para hoje" text="Gere o cronograma semanal para distribuir as disciplinas automaticamente." action={<Button asChild size="sm" className="rounded-xl"><Link to="/planejador">Abrir planejador</Link></Button>} />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Horas na semana" value={fmtHours(d.weekMin)} hint={`Meta ${settings.weeklyHoursGoal} h`} icon={<Clock className="h-3.5 w-3.5" />} tone="primary" />
        <Stat label="Horas no mês" value={fmtHours(d.monthMin)} icon={<CalendarCheck className="h-3.5 w-3.5" />} />
        <Stat label="Questões" value={d.questions} icon={<BookCheck className="h-3.5 w-3.5" />} />
        <Stat label="Acerto geral" value={d.accuracy === null ? "—" : pct(d.accuracy)} hint={`Meta ${settings.targetAccuracy}%`} icon={<Target className="h-3.5 w-3.5" />} tone="warm" />
        <Stat label="Melhor desempenho" value={<span className="text-base">{d.best?.name ?? "—"}</span>} hint={d.best ? pct(d.best.accuracy) : "Mín. 5 questões"} icon={<Award className="h-3.5 w-3.5" />} />
        <Stat label="Precisa de atenção" value={<span className="text-base">{d.attention?.name ?? "—"}</span>} hint="Maior prioridade" icon={<TriangleAlert className="h-3.5 w-3.5" />} />
        <Stat label="Conteúdos dominados" value={`${d.masteredTopics}/${d.totalTopics}`} hint="3+ revisões bem-sucedidas" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <Stat label="Revisões pendentes" value={d.pending} icon={<Repeat className="h-3.5 w-3.5" />} tone={d.pending ? "warm" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Evolução da concentração" action={<span className="text-xs text-muted-foreground">14 dias</span>}>
          {d.concentration.length >= 2 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.concentration} margin={{ left: -22, right: 8, top: 8 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="value" name="Concentração" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="Poucos registros" text="Conclua sessões no modo estudo para acompanhar a evolução." />
          )}
        </Panel>
        <Panel title="Consistência semanal" action={<span className="flex items-center gap-1 text-xs font-medium text-accent-foreground"><Flame className="h-3.5 w-3.5" />{d.daysStudiedLast7}/7 dias</span>}>
          <div className="space-y-3">
            {d.weeks.map((w) => (
              <div key={w.label} className="flex items-center gap-3">
                <span className="w-12 text-xs text-muted-foreground">{w.label}</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} className={cn("h-5 flex-1 rounded-md", i < w.days ? "bg-primary" : "bg-muted")} />
                  ))}
                </div>
                <span className="w-14 text-right text-xs tabular text-muted-foreground">{fmtHours(w.minutes)}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Cada quadrado representa um dia com estudo registrado.</p>
          </div>
        </Panel>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">O progresso até a meta é um indicador interno (horas, acertos e conteúdos dominados), não uma previsão de aprovação.</p>
    </div>
  );
}
