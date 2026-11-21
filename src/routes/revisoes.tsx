import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, Notice, NumberField, PageHeader, Panel } from "@/components/app/kit";
import { DAY_MS, endOfDay, fmt } from "@/lib/dates";
import { DEFAULT_INTERVALS, reviewItems, stageLabel, type ReviewItem } from "@/lib/review";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisoes")({
  head: () => ({
    meta: [
      { title: "Revisão espaçada — FocusStudy" },
      { name: "description", content: "Revisões em 24 h, 7, 15 e 30 dias, ajustadas pelo seu desempenho e priorizando assuntos com erros." },
      { property: "og:title", content: "Revisão espaçada — FocusStudy" },
      { property: "og:description", content: "Revisões automáticas ajustadas pelo desempenho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const subjects = useApp((s) => s.subjects);
  const intervals = useApp((s) => s.settings.reviewIntervals);
  const setSettings = useApp((s) => s.setSettings);
  const now = new Date();
  const all = reviewItems(subjects, now);
  const limit = endOfDay(now).getTime();
  const today = all.filter((r) => r.due.getTime() <= limit);
  const upcoming = all.filter((r) => r.due.getTime() > limit && r.due.getTime() <= limit + 14 * DAY_MS);
  const flagged = all.filter((r) => r.topic.flagged);

  return (
    <div className="space-y-5">
      <PageHeader title="Revisões" subtitle="Revisão espaçada ajustada pelo seu desempenho." />
      <Tabs defaultValue="hoje">
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="hoje" className="rounded-lg">Hoje ({today.length})</TabsTrigger>
          <TabsTrigger value="proximas" className="rounded-lg">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="prioritarias" className="rounded-lg">Com erros ({flagged.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje" className="mt-4">
          <List items={today} empty="Nada para revisar hoje. Conteúdos estudados entram aqui automaticamente após 24 h." />
        </TabsContent>
        <TabsContent value="proximas" className="mt-4">
          <List items={upcoming} empty="Nenhuma revisão nos próximos 14 dias." />
        </TabsContent>
        <TabsContent value="prioritarias" className="mt-4">
          <List items={flagged} empty="Nenhum assunto marcado por erros. Assuntos com menos de 60% de acertos aparecem aqui." />
        </TabsContent>
      </Tabs>

      <Panel title="Intervalos de revisão">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {intervals.map((v, i) => (
            <NumberField
              key={i}
              label={`${i + 1}ª revisão`}
              suffix="dias"
              min={1}
              max={180}
              value={v}
              onChange={(n) => {
                const next = [...intervals];
                next[i] = n;
                setSettings({ reviewIntervals: next });
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSettings({ reviewIntervals: [...DEFAULT_INTERVALS] })}>Restaurar 1 · 7 · 15 · 30</Button>
        </div>
        <div className="mt-4">
          <Notice>
            Como o desempenho ajusta as revisões: com 80% ou mais de acertos você avança para o próximo intervalo (com 90%
            ou mais, os próximos intervalos ficam 10% maiores); entre 60% e 79% o intervalo atual se repete; abaixo de 60% o assunto volta uma etapa, é
            marcado como prioritário e reaparece no dia seguinte. Errar questões em uma sessão também antecipa a revisão.
          </Notice>
        </div>
      </Panel>
    </div>
  );
}

function List({ items, empty }: { items: ReviewItem[]; empty: string }) {
  if (!items.length) return <Empty title="Tudo em dia" text={empty} />;
  return (
    <ul className="space-y-2.5">
      {items.map((r) => <Item key={r.topic.id} r={r} />)}
    </ul>
  );
}

function Item({ r }: { r: ReviewItem }) {
  const reviewTopic = useApp((s) => s.reviewTopic);
  const planStudy = useApp((s) => s.planStudy);
  const blockMin = useApp((s) => s.settings.blockMin);
  const navigate = useNavigate();
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const rate = (acc: number, label: string) => {
    reviewTopic(r.subject.id, r.topic.id, acc);
    setDoneMsg(label);
    toast.success("Revisão registrada", { description: `${r.topic.name}: ${label}` });
  };
  return (
    <li className={cn("rounded-2xl border bg-card p-3.5 shadow-card", r.topic.flagged && "border-warning")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{r.subject.name}</p>
          <p className="font-semibold text-foreground">{r.topic.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stageLabel(r.topic)} · {r.overdueDays > 0 ? <span className="font-semibold text-destructive">atrasada {r.overdueDays} dia(s)</span> : `prevista para ${fmt(r.due, "dd/MM")}`}
          </p>
        </div>
        {r.topic.flagged ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Prioritária" /> : null}
      </div>
      {doneMsg ? null : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Como foi a revisão?</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => rate(40, "errei muito")}>Errei muito</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => rate(70, "parcial")}>Parcial</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => rate(90, "acertei bem")}>Acertei bem</Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => {
              planStudy({ subjectId: r.subject.id, topicId: r.topic.id, kind: "revisao", blockId: null, minutes: Math.min(30, blockMin) });
              void navigate({ to: "/estudar" });
            }}
          >
            <Play /> Revisar no modo estudo (com questões)
          </Button>
        </div>
      )}
    </li>
  );
}
