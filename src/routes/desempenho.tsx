import { createFileRoute } from "@tanstack/react-router";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Notice, PageHeader, Panel } from "@/components/app/kit";
import { emptyDraft, SessionForm } from "@/components/app/SessionForm";
import { accuracyOf, avg, byHour, bySubject, dailySeries, insights, lastSessions, sleepVsProductivity } from "@/lib/analytics";
import { fmt, fmtMinutes } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/planner";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/desempenho")({
  head: () => ({
    meta: [
      { title: "Meu Desempenho — FocusStudy" },
      { name: "description", content: "Descubra em quais horários e condições você rende mais: gráficos por horário, disciplina, sono e concentração." },
      { property: "og:title", content: "Meu Desempenho — FocusStudy" },
      { property: "og:description", content: "Padrões de desempenho baseados apenas nos seus registros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

const tip = { contentStyle: { borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 } };
const axis = { tick: { fontSize: 11 }, stroke: "var(--muted-foreground)" };

function PerformancePage() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const addSession = useApp((s) => s.addSession);
  const deleteSession = useApp((s) => s.deleteSession);
  const [open, setOpen] = useState(false);
  const now = new Date();

  const data = useMemo(() => {
    const n = new Date();
    return {
      insights: insights(subjects, sessions),
      hour: byHour(sessions),
      subject: bySubject(subjects, sessions),
      conc: dailySeries(sessions, n, 30, (ss) => (ss.length ? avg(ss.map((s) => s.diary.focusQuality)) : null)),
      acc: dailySeries(sessions, n, 30, (ss) => accuracyOf(ss)),
      sleep: sleepVsProductivity(sessions),
      last: lastSessions(subjects, sessions, 10),
    };
  }, [subjects, sessions]);
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const history = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meu Desempenho"
        subtitle={`${sessions.length} sessões registradas`}
        action={<Button className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Registrar</Button>}
      />

      <Panel title="Observações sobre seus registros" action={<Eye className="h-4 w-4 text-muted-foreground" />}>
        {data.insights.length ? (
          <ul className="space-y-2.5">
            {data.insights.map((i) => (
              <li key={i.text} className="rounded-xl bg-primary-soft p-3 text-sm text-foreground">
                {i.text}
                <span className="mt-1 block text-[11px] text-muted-foreground">Baseado em {i.n} sessões.</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {sessions.length < 4 ? `Registre pelo menos 4 sessões (faltam ${4 - sessions.length}) para começar a identificar padrões.` : "Ainda não há diferenças marcantes nos seus registros. Continue registrando em horários e condições variadas."}
          </p>
        )}
        <div className="mt-3">
          <Notice>São correlações observadas nos seus próprios dados, não relações de causa. As diferenças não são atribuídas automaticamente à medicação nem a qualquer outro fator isolado.</Notice>
        </div>
      </Panel>

      {sessions.length === 0 ? (
        <Empty title="Sem dados para os gráficos" text="Use o modo estudo ou registre uma sessão manualmente." action={<Button className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Registrar sessão</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Desempenho por horário de início">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.hour} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" {...axis} />
                  <YAxis yAxisId="a" domain={[0, 100]} {...axis} />
                  <YAxis yAxisId="c" orientation="right" domain={[0, 10]} hide />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <RBar yAxisId="a" dataKey="acertos" name="Acertos (%)" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <RBar yAxisId="c" dataKey="concentracao" name="Concentração (0–10)" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Desempenho por disciplina">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.subject} layout="vertical" margin={{ left: 10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} {...axis} />
                  <YAxis type="category" dataKey="name" width={96} {...axis} />
                  <Tooltip {...tip} />
                  <RBar dataKey="acertos" name="Acertos (%)" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Evolução da concentração" action={<span className="text-xs text-muted-foreground">30 dias</span>}>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={data.conc} margin={{ left: -20, right: 8, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" {...axis} />
                  <YAxis domain={[0, 10]} {...axis} />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="value" name="Concentração" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Evolução dos acertos" action={<span className="text-xs text-muted-foreground">30 dias</span>}>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={data.acc} margin={{ left: -20, right: 8, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" {...axis} />
                  <YAxis domain={[0, 100]} {...axis} />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="value" name="Acertos (%)" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Qualidade do sono × produtividade">
            <div className="h-52">
              <ResponsiveContainer>
                <ScatterChart margin={{ left: -20, right: 8, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="sono" name="Sono" domain={[0, 10]} {...axis} />
                  <YAxis type="number" dataKey="minutos" name="Minutos" {...axis} />
                  <ZAxis type="number" dataKey="concentracao" range={[40, 200]} name="Concentração" />
                  <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={data.sleep} fill="var(--chart-2)" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">Cada ponto é uma sessão: sono (0–10) × minutos estudados. Pontos maiores = maior concentração.</p>
          </Panel>

          <Panel title="Comparação entre sessões" action={<span className="text-xs text-muted-foreground">últimas 10</span>}>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={data.last} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" {...axis} tick={{ fontSize: 9 }} />
                  <YAxis {...axis} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <RBar dataKey="minutos" name="Minutos" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <RBar dataKey="acertos" name="Acertos (%)" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      <Panel title="Histórico de sessões">
        {history.length ? (
          <ul className="divide-y">
            {history.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.subjectId ? (names.get(s.subjectId) ?? "—") : "Estudo livre"} <span className="font-normal text-muted-foreground">· {KIND_LABEL[s.kind]}</span></p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmt(s.startedAt, "dd/MM HH:mm")} · {fmtMinutes(s.studiedMin)} · começar {s.startDelayMin} min · {s.interruptions} interr. · {s.questions ? `${s.correct}/${s.questions} (${Math.round((s.correct / s.questions) * 100)}%)` : "sem questões"} · sono {s.sleep} · ansiedade {s.anxiety} · cansaço {s.fatigue}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Excluir sessão" onClick={() => { if (confirm("Excluir esta sessão?")) deleteSession(s.id); }}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma sessão.</p>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar sessão</DialogTitle>
          </DialogHeader>
          <SessionForm
            subjects={subjects}
            initial={{ ...emptyDraft(), startedAt: new Date(now.getTime() - 60 * 60_000).toISOString() }}
            onCancel={() => setOpen(false)}
            onSubmit={(s) => {
              addSession(s);
              setOpen(false);
              toast.success("Sessão registrada");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
