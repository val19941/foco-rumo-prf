import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL } from "@/lib/planner";
import type { Diary, DistractionSource, Session, SessionKind, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Chips, NumberField, Scale } from "./kit";

export type SessionDraft = Omit<Session, "id">;

export function emptyDiary(): Diary {
  return {
    easeStart: 5,
    attention: 5,
    distractions: 0,
    source: "nenhuma",
    comprehension: 5,
    recall: 5,
    finishDifficulty: 5,
    energy: 5,
    focusQuality: 5,
  };
}

export function emptyDraft(): SessionDraft {
  return {
    startedAt: new Date().toISOString(),
    subjectId: null,
    topicId: null,
    kind: "teoria",
    startDelayMin: 0,
    studiedMin: 50,
    interruptions: 0,
    questions: 0,
    correct: 0,
    sleep: 6,
    anxiety: 3,
    fatigue: 4,
    diary: emptyDiary(),
    notes: "",
  };
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

const STEPS = ["Sessão", "Como você estava", "Diário de concentração"] as const;

export function SessionForm({
  subjects,
  initial,
  lockTiming = false,
  onSubmit,
  onCancel,
  submitLabel = "Salvar sessão",
}: {
  subjects: Subject[];
  initial: SessionDraft;
  lockTiming?: boolean;
  onSubmit: (s: SessionDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [d, setD] = useState<SessionDraft>(initial);
  const [step, setStep] = useState(0);
  const set = <K extends keyof SessionDraft>(k: K, v: SessionDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setDiary = <K extends keyof Diary>(k: K, v: Diary[K]) => setD((x) => ({ ...x, diary: { ...x.diary, [k]: v } }));
  const subject = subjects.find((s) => s.id === d.subjectId) ?? null;
  const accuracy = d.questions > 0 ? Math.round((d.correct / d.questions) * 100) : null;

  const error = useMemo(() => {
    if (d.studiedMin <= 0) return "Informe o tempo efetivamente estudado.";
    if (d.correct > d.questions) return "Os acertos não podem ser maiores que as questões resolvidas.";
    return null;
  }, [d]);

  return (
    <div className="space-y-5">
      <ol className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" onClick={() => setStep(i)} className="w-full text-left">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("mt-1.5 block text-[11px] font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Disciplina</label>
              <Select value={d.subjectId ?? "livre"} onValueChange={(v) => setD((x) => ({ ...x, subjectId: v === "livre" ? null : v, topicId: null }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Estudo livre</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Conteúdo</label>
              <Select value={d.topicId ?? "none"} onValueChange={(v) => set("topicId", v === "none" ? null : v)} disabled={!subject}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conteúdo específico</SelectItem>
                  {subject?.topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de atividade</label>
            <Chips<SessionKind>
              value={d.kind}
              onChange={(v) => set("kind", v)}
              options={(["teoria", "questoes", "revisao"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            />
          </div>
          {!lockTiming && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Horário de início</label>
              <input
                type="datetime-local"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={toLocalInput(d.startedAt)}
                onChange={(e) => e.target.value && set("startedAt", new Date(e.target.value).toISOString())}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Tempo p/ começar" suffix="min" value={d.startDelayMin} onChange={(v) => set("startDelayMin", v)} />
            <NumberField label="Tempo estudado" suffix="min" step={5} value={d.studiedMin} onChange={(v) => set("studiedMin", v)} />
            <NumberField label="Interrupções" value={d.interruptions} onChange={(v) => set("interruptions", v)} />
            <NumberField label="Questões resolvidas" value={d.questions} onChange={(v) => setD((x) => ({ ...x, questions: v, correct: Math.min(x.correct, v) }))} />
            <NumberField label="Acertos" value={d.correct} max={d.questions} onChange={(v) => set("correct", v)} />
            <div className="flex flex-col justify-end rounded-xl bg-primary-soft p-3">
              <span className="text-xs text-muted-foreground">Percentual de acertos</span>
              <span className="font-display text-2xl font-bold tabular text-primary">{accuracy === null ? "—" : `${accuracy}%`}</span>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <Scale label="Qualidade do sono (noite anterior)" value={d.sleep} onChange={(v) => set("sleep", v)} low="Muito ruim" high="Excelente" />
          <Scale label="Ansiedade ou inquietação" value={d.anxiety} onChange={(v) => set("anxiety", v)} low="Nenhuma" high="Muito alta" />
          <Scale label="Cansaço mental" value={d.fatigue} onChange={(v) => set("fatigue", v)} low="Descansado" high="Exausto" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Scale label="1. Foi fácil começar a estudar?" value={d.diary.easeStart} onChange={(v) => setDiary("easeStart", v)} low="Muito difícil" high="Muito fácil" />
          <Scale label="2. Você conseguiu manter a atenção?" value={d.diary.attention} onChange={(v) => setDiary("attention", v)} low="Nada" high="Totalmente" />
          <div className="space-y-3">
            <NumberField label="3. Quantas vezes se distraiu?" value={d.diary.distractions} onChange={(v) => setDiary("distractions", v)} />
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Principal origem das distrações</span>
              <Chips<DistractionSource>
                value={d.diary.source}
                onChange={(v) => setDiary("source", v)}
                options={[
                  { value: "nenhuma", label: "Nenhuma" },
                  { value: "externa", label: "Ambiente/celular" },
                  { value: "pensamentos", label: "Pensamentos" },
                  { value: "ambos", label: "Ambos" },
                ]}
              />
            </div>
          </div>
          <Scale label="4. Conseguiu compreender o conteúdo?" value={d.diary.comprehension} onChange={(v) => setDiary("comprehension", v)} low="Nada" high="Totalmente" />
          <Scale label="5. Conseguiu lembrar sem consultar o material?" hint="Também usado como facilidade de memorização." value={d.diary.recall} onChange={(v) => setDiary("recall", v)} low="Nada" high="Tudo" />
          <Scale label="6. Teve dificuldade para concluir a atividade?" value={d.diary.finishDifficulty} onChange={(v) => setDiary("finishDifficulty", v)} low="Nenhuma" high="Muita" />
          <Scale label="7. Como estava seu nível de energia?" value={d.diary.energy} onChange={(v) => setDiary("energy", v)} low="Muito baixo" high="Muito alto" />
          <Scale label="8. Como estava sua qualidade de concentração?" hint="Também usada como concentração percebida." value={d.diary.focusQuality} onChange={(v) => setDiary("focusQuality", v)} low="Muito ruim" high="Excelente" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: estudei na biblioteca, barulho de obra..." className="rounded-xl" />
          </div>
        </div>
      )}

      {error && step === STEPS.length - 1 ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <div className="flex gap-2 pt-1">
        {step > 0 ? (
          <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setStep(step - 1)}>Voltar</Button>
        ) : onCancel ? (
          <Button type="button" variant="ghost" className="h-11 flex-1 rounded-xl" onClick={onCancel}>Cancelar</Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="h-11 flex-1 rounded-xl" onClick={() => setStep(step + 1)}>Continuar</Button>
        ) : (
          <Button type="button" className="h-11 flex-1 rounded-xl" disabled={!!error} onClick={() => onSubmit(d)}>{submitLabel}</Button>
        )}
      </div>
    </div>
  );
}
