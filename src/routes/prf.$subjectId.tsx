import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/ConfirmReplace";
import { Empty, PageHeader, Panel, Scale, Stat } from "@/components/app/kit";
import { fmt, fmtMinutes } from "@/lib/dates";
import { priorityScore, subjectStats } from "@/lib/planner";
import { stageLabel } from "@/lib/review";
import { useApp } from "@/lib/store";
import type { Subject, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prf/$subjectId")({
  head: () => ({
    meta: [
      { title: "Disciplina — Preparação PRF — FocusStudy" },
      { name: "description", content: "Conteúdos, domínio, acertos, revisões e tempo investido nesta disciplina." },
      { property: "og:title", content: "Disciplina — Preparação PRF" },
      { property: "og:description", content: "Detalhes e conteúdos da disciplina no edital da PRF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubjectPage,
});

function Level({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className={cn("h-10 rounded-xl border text-sm font-bold", n <= value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const subject = useApp((s) => s.subjects.find((x) => x.id === subjectId));
  const sessions = useApp((s) => s.sessions);
  const updateSubject = useApp((s) => s.updateSubject);
  const deleteSubject = useApp((s) => s.deleteSubject);
  const addTopic = useApp((s) => s.addTopic);
  const navigate = useNavigate();
  const [topicName, setTopicName] = useState("");
  const [confirm, setConfirm] = useState(false);

  if (!subject)
    return (
      <Empty title="Disciplina não encontrada" action={<Button asChild className="rounded-xl"><Link to="/prf">Voltar</Link></Button>} />
    );
  const st = subjectStats(subject, sessions);
  const p = priorityScore(subject, st, new Date());

  return (
    <div className="space-y-5">
      <Link to="/prf" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Preparação PRF</Link>
      <PageHeader title={subject.name} subtitle={`Prioridade calculada: ${Math.round(p.score * 100)}/100`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Questões" value={st.questions} />
        <Stat label="Acertos" value={st.accuracy === null ? "—" : `${Math.round(st.accuracy)}%`} tone="primary" />
        <Stat label="Tempo investido" value={fmtMinutes(st.minutes)} />
        <Stat label="Última revisão" value={st.lastReview ? fmt(st.lastReview, "dd/MM") : "—"} />
        <Stat label="Próxima revisão" value={st.nextReview ? fmt(st.nextReview, "dd/MM") : "—"} tone="warm" />
        <Stat label="Sessões" value={st.sessions} />
      </div>

      <Panel title="Configuração">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome</label>
            <Input value={subject.name} onChange={(e) => updateSubject(subject.id, { name: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <Level label="Importância no edital" value={subject.importance} onChange={(v) => updateSubject(subject.id, { importance: v })} />
          <Level label="Dificuldade do conteúdo" value={subject.difficulty} onChange={(v) => updateSubject(subject.id, { difficulty: v })} />
          <Scale label="Grau de domínio (sua avaliação)" value={subject.mastery} onChange={(v) => updateSubject(subject.id, { mastery: v })} low="Nenhum" high="Domino" />
        </div>
      </Panel>

      <Panel title={`Conteúdos (${subject.topics.length})`}>
        <ul className="space-y-2">
          {subject.topics.map((t) => <TopicRow key={t.id} subject={subject} topic={t} />)}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = topicName.trim();
            if (!n) return;
            addTopic(subject.id, n);
            setTopicName("");
          }}
        >
          <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="Novo tópico do edital" className="h-11 rounded-xl" />
          <Button type="submit" className="h-11 rounded-xl"><Plus /> Tópico</Button>
        </form>
      </Panel>

      <Button variant="ghost" className="w-full rounded-xl text-destructive hover:text-destructive" onClick={() => setConfirm(true)}>
        <Trash2 /> Excluir disciplina
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Excluir disciplina?"
        description="Os tópicos e os blocos do planejador desta disciplina serão removidos. As sessões já registradas continuam no histórico."
        confirmLabel="Excluir"
        onConfirm={() => {
          deleteSubject(subject.id);
          toast.success("Disciplina excluída");
          void navigate({ to: "/prf" });
        }}
      />
    </div>
  );
}

function TopicRow({ subject, topic }: { subject: Subject; topic: Topic }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState("");
  const { updateTopic, deleteTopic, addSubtopic, toggleSubtopic, deleteSubtopic, markTopicLearned } = useApp.getState();
  const done = topic.subtopics.filter((s) => s.done).length;
  return (
    <li className="rounded-xl border">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", topic.learnedAt ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>
          {topic.learnedAt ? <Check className="h-4 w-4" /> : <BookOpen className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{topic.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {stageLabel(topic)}
            {topic.nextReview ? ` · próxima ${fmt(topic.nextReview, "dd/MM")}` : ""}
            {topic.subtopics.length ? ` · ${done}/${topic.subtopics.length} subtópicos` : ""}
            {topic.flagged ? " · com erros" : ""}
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3">
          <Input value={topic.name} onChange={(e) => updateTopic(subject.id, topic.id, { name: e.target.value })} className="h-10 rounded-xl" aria-label="Nome do tópico" />
          {topic.subtopics.length ? (
            <ul className="space-y-1">
              {topic.subtopics.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleSubtopic(subject.id, topic.id, s.id)} className={cn("flex h-5 w-5 items-center justify-center rounded-md border", s.done ? "border-primary bg-primary text-primary-foreground" : "border-input")} aria-label={s.done ? "Desmarcar" : "Marcar"}>
                    {s.done ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>{s.name}</span>
                  <button type="button" onClick={() => deleteSubtopic(subject.id, topic.id, s.id)} className="p-1 text-muted-foreground" aria-label="Excluir subtópico"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = sub.trim();
              if (!n) return;
              addSubtopic(subject.id, topic.id, n);
              setSub("");
            }}
          >
            <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Novo subtópico" className="h-9 rounded-xl" />
            <Button type="submit" size="sm" variant="outline" className="h-9 rounded-xl"><Plus /></Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {!topic.learnedAt ? (
              <Button size="sm" className="rounded-xl" onClick={() => { markTopicLearned(subject.id, topic.id); toast.success("Primeira revisão agendada para daqui a 24 h"); }}>
                <Check /> Marcar como estudado
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={() => deleteTopic(subject.id, topic.id)}>
              <Trash2 /> Excluir tópico
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
