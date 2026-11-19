import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Flag, Pause, Play, Plus, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chips, NumberField, PageHeader, Panel, Ring } from "@/components/app/kit";
import { MedStatus } from "@/components/app/MedStatus";
import { emptyDraft, SessionForm } from "@/components/app/SessionForm";
import { KIND_LABEL } from "@/lib/planner";
import { notify } from "@/lib/notifications";
import { useApp, useNow } from "@/lib/store";
import type { ActiveStudy, ID, SessionKind } from "@/lib/types";

export const Route = createFileRoute("/estudar")({
  head: () => ({
    meta: [
      { title: "Modo estudo — FocusStudy" },
      { name: "description", content: "Cronômetro de estudo com blocos, contagem de interrupções e diário de concentração ao final." },
      { property: "og:title", content: "Modo estudo — FocusStudy" },
      { property: "og:description", content: "Foque no bloco atual; o FocusStudy registra o resto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

function elapsedMs(a: ActiveStudy, now: Date) {
  if (!a.startedAt) return 0;
  const end = a.pausedAt ? new Date(a.pausedAt).getTime() : now.getTime();
  return Math.max(0, end - new Date(a.startedAt).getTime() - a.pausedMs);
}

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, "0");
  return h ? `${h}:${mm}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
}

function StudyPage() {
  const active = useApp((s) => s.active);
  const [finishing, setFinishing] = useState(false);
  if (active && finishing) return <Finish active={active} onBack={() => setFinishing(false)} />;
  if (active) return <Running active={active} onFinish={() => setFinishing(true)} />;
  return <Setup />;
}

function Setup() {
  const subjects = useApp((s) => s.subjects);
  const pending = useApp((s) => s.pendingStudy);
  const blockMin = useApp((s) => s.settings.blockMin);
  const prepare = useApp((s) => s.prepare);
  const begin = useApp((s) => s.begin);
  const [subjectId, setSubjectId] = useState<ID | null>(pending?.subjectId ?? subjects[0]?.id ?? null);
  const [topicId, setTopicId] = useState<ID | null>(pending?.topicId ?? null);
  const [kind, setKind] = useState<SessionKind>(pending?.kind ?? "teoria");
  const [minutes, setMinutes] = useState(pending?.minutes ?? blockMin);
  const subject = subjects.find((s) => s.id === subjectId);

  const go = (direct: boolean) => {
    prepare({ subjectId, topicId, kind, blockId: pending?.blockId ?? null, targetMin: minutes });
    if (direct) begin();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Modo estudo" subtitle="Escolha o que vai estudar e comece com uma meta pequena." />
      {pending?.blockId ? (
        <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">Bloco do planejador selecionado. Ao concluir, ele será marcado como feito.</p>
      ) : null}
      <Panel>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Disciplina</label>
              <Select value={subjectId ?? "livre"} onValueChange={(v) => { setSubjectId(v === "livre" ? null : v); setTopicId(null); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Estudo livre</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Conteúdo</label>
              <Select value={topicId ?? "none"} onValueChange={(v) => setTopicId(v === "none" ? null : v)} disabled={!subject}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conteúdo específico</SelectItem>
                  {subject?.topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Atividade</label>
            <Chips<SessionKind> value={kind} onChange={setKind} options={(["teoria", "questoes", "revisao"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          </div>
          <NumberField label="Duração do bloco" suffix="min" step={5} min={5} max={180} value={minutes} onChange={setMinutes} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="h-12 rounded-xl text-base" onClick={() => go(false)}><Zap /> Preparar para começar</Button>
            <Button variant="outline" className="h-12 rounded-xl text-base" onClick={() => go(true)}><Play /> Já vou começar agora</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “Preparar” mede quanto tempo você leva para começar de fato — um dado útil para o Diário de Concentração.
          </p>
        </div>
      </Panel>
      <MedStatus compact />
      <p className="text-center text-sm text-muted-foreground">
        Estudou sem o cronômetro? <Link to="/desempenho" className="font-medium text-primary">Registre a sessão manualmente</Link>.
      </p>
    </div>
  );
}

function Running({ active, onFinish }: { active: ActiveStudy; onFinish: () => void }) {
  const now = useNow(1000);
  const subjects = useApp((s) => s.subjects);
  const breakMin = useApp((s) => s.settings.breakMin);
  const { begin, pause, resume, interrupt, cancelActive } = useApp.getState();
  const subject = subjects.find((s) => s.id === active.subjectId);
  const topic = subject?.topics.find((t) => t.id === active.topicId);
  const ms = elapsedMs(active, now);
  const target = active.targetMin * 60_000;
  const done = ms >= target;
  const notified = useRef(false);

  useEffect(() => {
    if (done && !notified.current && active.startedAt && !active.pausedAt) {
      notified.current = true;
      void notify("Bloco concluído!", `Você completou ${active.targetMin} min. Faça uma pausa de ${breakMin} min ou finalize a sessão.`, { url: "/estudar" });
    }
  }, [done, active, breakMin]);

  // Keep the screen on during the session where supported (Android Chrome).
  useEffect(() => {
    if (!active.startedAt || active.pausedAt) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, [active.startedAt, active.pausedAt]);

  if (!active.startedAt) {
    const wait = now.getTime() - new Date(active.preparedAt).getTime();
    return (
      <div className="space-y-5">
        <PageHeader title="Preparando..." subtitle={`${subject?.name ?? "Estudo livre"}${topic ? ` · ${topic.name}` : ""}`} />
        <Panel className="text-center">
          <p className="text-sm text-muted-foreground">Tempo desde que você decidiu começar</p>
          <p className="mt-2 font-display text-5xl font-bold tabular text-foreground">{clock(wait)}</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">Meta inicial: apenas 5 minutos. Abra o material e leia o primeiro parágrafo.</p>
          <Button className="mt-6 h-14 w-full max-w-xs rounded-2xl text-lg" onClick={begin}><Play /> Comecei a estudar</Button>
          <div className="mt-3">
            <Button variant="ghost" onClick={cancelActive}><X /> Cancelar</Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={subject?.name ?? "Estudo livre"} subtitle={`${KIND_LABEL[active.kind]}${topic ? ` · ${topic.name}` : ""}`} />
      <Panel className="flex flex-col items-center py-8 text-center">
        <Ring value={ms / target} size={230} stroke={14}>
          <span className="font-display text-5xl font-bold tabular text-foreground">{clock(ms)}</span>
          <span className="mt-1 text-sm text-muted-foreground">de {active.targetMin} min</span>
          {active.pausedAt ? <span className="mt-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">Pausado</span> : null}
        </Ring>
        {done ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
            <Coffee className="h-4 w-4" /> Bloco concluído — pausa sugerida de {breakMin} min.
          </p>
        ) : null}
        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2">
          {active.pausedAt ? (
            <Button className="h-12 rounded-xl" onClick={resume}><Play /> Retomar</Button>
          ) : (
            <Button variant="secondary" className="h-12 rounded-xl" onClick={pause}><Pause /> Pausar</Button>
          )}
          <Button variant="outline" className="h-12 rounded-xl" onClick={() => { interrupt(); toast("Interrupção registrada"); }}>
            <Plus /> Interrupção ({active.interruptions})
          </Button>
          <Button className="col-span-2 h-12 rounded-xl" onClick={() => { if (!active.pausedAt) pause(); onFinish(); }}><Flag /> Finalizar sessão</Button>
        </div>
        <button type="button" className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => { if (confirm("Descartar esta sessão sem salvar?")) cancelActive(); }}>
          Descartar sessão
        </button>
      </Panel>
      <MedStatus compact />
    </div>
  );
}

function Finish({ active, onBack }: { active: ActiveStudy; onBack: () => void }) {
  const subjects = useApp((s) => s.subjects);
  const addSession = useApp((s) => s.addSession);
  const cancelActive = useApp((s) => s.cancelActive);
  const resume = useApp((s) => s.resume);
  const navigate = useNavigate();
  const ms = elapsedMs(active, new Date());
  const startedAt = active.startedAt ?? active.preparedAt;
  const delay = Math.round((new Date(startedAt).getTime() - new Date(active.preparedAt).getTime()) / 60_000);
  const initial = {
    ...emptyDraft(),
    startedAt,
    subjectId: active.subjectId,
    topicId: active.topicId,
    kind: active.kind,
    startDelayMin: Math.max(0, delay),
    studiedMin: Math.max(1, Math.round(ms / 60_000)),
    interruptions: active.interruptions,
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Como foi a sessão?" subtitle="Respostas rápidas alimentam o Diário de Concentração e o Meu Desempenho." />
      <Panel>
        <SessionForm
          subjects={subjects}
          initial={initial}
          lockTiming
          onCancel={() => { resume(); onBack(); }}
          onSubmit={(s) => {
            addSession(s, active.blockId);
            cancelActive();
            toast.success("Sessão salva", { description: "Revisões e indicadores foram atualizados." });
            void navigate({ to: "/" });
          }}
        />
      </Panel>
    </div>
  );
}
