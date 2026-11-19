import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bar, PageHeader, Panel } from "@/components/app/kit";
import { fmt, fmtMinutes } from "@/lib/dates";
import { priorityScore, subjectStats } from "@/lib/planner";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prf/")({
  head: () => ({
    meta: [
      { title: "Preparação PRF — FocusStudy" },
      { name: "description", content: "Disciplinas, tópicos e subtópicos do edital da PRF com domínio, acertos, revisões e tempo investido." },
      { property: "og:title", content: "Preparação PRF — FocusStudy" },
      { property: "og:description", content: "Organize o edital da PRF por disciplina, tópico e subtópico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrfPage,
});

function Dots({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < n ? "bg-highlight" : "bg-muted")} />
      ))}
    </span>
  );
}

function PrfPage() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const addSubject = useApp((s) => s.addSubject);
  const [name, setName] = useState("");
  const now = new Date();
  const topics = subjects.flatMap((s) => s.topics);
  const started = topics.filter((t) => t.learnedAt).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Preparação PRF" subtitle={`${subjects.length} disciplinas · ${started}/${topics.length} conteúdos iniciados`} />
      <Panel>
        <Bar value={topics.length ? started / topics.length : 0} />
        <p className="mt-2 text-xs text-muted-foreground">Edite as disciplinas conforme o edital vigente. O peso no edital influencia o planejador e a ordem de prioridade.</p>
      </Panel>

      <ul className="grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => {
          const st = subjectStats(s, sessions);
          const p = priorityScore(s, st, now).score;
          return (
            <li key={s.id}>
              <Link to="/prf/$subjectId" params={{ subjectId: s.id }} className="block rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-foreground">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">Peso <Dots n={s.importance} /> · {s.topics.length} tópicos</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-semibold tabular text-primary">
                    P{Math.round(p * 100)} <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Domínio</span><span className="tabular">{s.mastery}/10</span></div>
                  <Bar value={s.mastery / 10} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[10px] text-muted-foreground">Questões</dt><dd className="font-display text-sm font-bold tabular">{st.questions}</dd></div>
                  <div><dt className="text-[10px] text-muted-foreground">Acertos</dt><dd className="font-display text-sm font-bold tabular">{st.accuracy === null ? "—" : `${Math.round(st.accuracy)}%`}</dd></div>
                  <div><dt className="text-[10px] text-muted-foreground">Tempo</dt><dd className="font-display text-sm font-bold tabular">{fmtMinutes(st.minutes)}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Última revisão: {st.lastReview ? fmt(st.lastReview, "dd/MM") : "—"} · Próxima: {st.nextReview ? fmt(st.nextReview, "dd/MM") : "—"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <Panel title="Adicionar disciplina">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            addSubject(n);
            setName("");
            toast.success("Disciplina adicionada");
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Geopolítica" className="h-11 rounded-xl" />
          <Button type="submit" className="h-11 rounded-xl"><Plus /> Adicionar</Button>
        </form>
      </Panel>
    </div>
  );
}
