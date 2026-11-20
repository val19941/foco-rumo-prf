import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarSync, Check, Loader2, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/ConfirmReplace";
import { Empty, Notice, PageHeader, Panel } from "@/components/app/kit";
import { buildAdvisorSummary, localRecommendations, mentionsMedication, type Recommendation } from "@/lib/advisor";
import { getAiAdvice, type AiAdvice } from "@/lib/advisor.functions";
import { fmtMinutes, startOfDay, uid } from "@/lib/dates";
import { generateWeekPlan } from "@/lib/planner";
import { useApp } from "@/lib/store";
import type { Focus, ID, PlanAdjust, PlanBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orientador")({
  head: () => ({
    meta: [
      { title: "Orientador de Estudos — FocusStudy" },
      { name: "description", content: "Recomendações para reorganizar o cronograma com base em acertos, revisões, concentração e disponibilidade." },
      { property: "og:title", content: "Orientador de Estudos — FocusStudy" },
      { property: "og:description", content: "Ajustes inteligentes no seu planejamento de estudos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdvisorPage,
});

const FOCUS_LABEL: Record<Focus, string> = { teoria: "mais teoria", pratica: "mais prática", equilibrado: "equilibrado" };
const TIPO_STYLE: Record<string, string> = {
  desempenho: "bg-accent text-accent-foreground",
  revisao: "bg-secondary text-secondary-foreground",
  concentracao: "bg-primary-soft text-primary",
  cronograma: "bg-muted text-foreground",
  dominio: "bg-secondary text-secondary-foreground",
};

function AdvisorPage() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const settings = useApp((s) => s.settings);
  const plan = useApp((s) => s.plan);
  const setAdjustments = useApp((s) => s.setAdjustments);
  const setSettings = useApp((s) => s.setSettings);
  const setPlan = useApp((s) => s.setPlan);
  const redistribute = useApp((s) => s.redistribute);

  const local = useMemo(() => localRecommendations(subjects, sessions, settings, new Date()), [subjects, sessions, settings]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [ai, setAi] = useState<AiAdvice | null>(null);
  const [aiSel, setAiSel] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ adjustments: Record<ID, PlanAdjust>; blockMin: number; blocks: PlanBlock[]; redistribute: ID[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [showData, setShowData] = useState(false);
  const names = new Map(subjects.map((s) => [s.id, s.name]));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAi = (i: number) => setAiSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const runAi = async () => {
    setLoading(true);
    try {
      const summary = buildAdvisorSummary(subjects, sessions, settings, new Date());
      const res = await getAiAdvice({ data: summary });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const ids = new Set(subjects.map((s) => s.id));
      const clean: AiAdvice = {
        resumo: mentionsMedication(res.advice.resumo) ? "" : res.advice.resumo,
        recomendacoes: res.advice.recomendacoes.filter((r) => !mentionsMedication(`${r.titulo} ${r.texto}`)),
        ajustes: res.advice.ajustes
          .filter((a) => ids.has(a.disciplinaId) && !mentionsMedication(a.motivo))
          .map((a) => ({ ...a, fator: Math.min(2, Math.max(0.5, Number(a.fator) || 1)) })),
      };
      setAi(clean);
      setAiSel(new Set(clean.ajustes.map((_, i) => i)));
    } catch {
      toast.error("Não foi possível falar com o orientador agora.");
    } finally {
      setLoading(false);
    }
  };

  const buildPreview = () => {
    const adjustments: Record<ID, PlanAdjust> = { ...settings.adjustments };
    let blockMin = settings.blockMin;
    const redis: ID[] = [];
    for (const r of local) {
      if (!selected.has(r.id) || !r.action) continue;
      if (r.action.type === "adjust") adjustments[r.action.subjectId] = { factor: r.action.factor, focus: r.action.focus };
      if (r.action.type === "blockMin") blockMin = r.action.value;
      if (r.action.type === "redistribute") redis.push(r.action.subjectId);
    }
    ai?.ajustes.forEach((a, i) => {
      if (aiSel.has(i)) adjustments[a.disciplinaId] = { factor: a.fator, focus: a.foco };
    });
    const blocks = generateWeekPlan({
      subjects,
      sessions,
      settings: { availability: settings.availability, blockMin },
      adjustments,
      start: startOfDay(new Date()),
      now: new Date(),
      idFactory: uid,
    });
    if (!blocks.length) {
      toast.error("Sem tempo disponível no planejador.");
      return;
    }
    setPreview({ adjustments, blockMin, blocks, redistribute: redis });
  };

  const apply = () => {
    if (!preview) return;
    setAdjustments(preview.adjustments);
    if (preview.blockMin !== settings.blockMin) setSettings({ blockMin: preview.blockMin });
    preview.redistribute.forEach((id) => redistribute(id));
    setPlan({ generatedAt: new Date().toISOString(), startDate: preview.blocks[0]?.date ?? "", blocks: preview.blocks });
    setPreview(null);
    setSelected(new Set());
    toast.success("Cronograma reorganizado", { description: "Veja a nova semana no planejador." });
  };

  const dist = (blocks: PlanBlock[]) => {
    const m = new Map<ID, number>();
    for (const b of blocks) m.set(b.subjectId, (m.get(b.subjectId) ?? 0) + b.minutes);
    return m;
  };
  const before = dist(plan?.blocks ?? []);
  const after = preview ? dist(preview.blocks) : new Map<ID, number>();
  const changes = preview
    ? [...new Set([...before.keys(), ...after.keys()])]
        .map((id) => ({ id, a: before.get(id) ?? 0, b: after.get(id) ?? 0 }))
        .sort((x, y) => y.b - x.b)
    : [];
  const anySelected = selected.size > 0 || aiSel.size > 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Orientador de Estudos" subtitle="Análise dos seus registros e propostas de ajuste no planejamento." />

      <Panel title="Recomendações a partir dos seus dados" action={<span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> no dispositivo</span>}>
        {local.length ? (
          <ul className="space-y-2.5">
            {local.map((r) => <RecItem key={r.id} r={r} on={selected.has(r.id)} onToggle={() => toggle(r.id)} />)}
          </ul>
        ) : (
          <Empty title="Sem recomendações por enquanto" text="Registre sessões com questões por alguns dias. O orientador compara semanas, disciplinas e revisões pendentes." />
        )}
      </Panel>

      <Panel title="Análise com IA" action={<Sparkles className="h-4 w-4 text-highlight" />}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A IA recebe apenas um resumo agregado dos estudos (acertos, tempo, revisões, indicadores de concentração e disponibilidade).
            Registros de medicação e anotações pessoais não são enviados.
          </p>
          <button type="button" className="text-xs font-medium text-primary" onClick={() => setShowData(!showData)}>
            {showData ? "Ocultar" : "Ver"} o que será enviado
          </button>
          {showData ? (
            <pre className="max-h-56 overflow-auto rounded-xl bg-muted p-3 text-[10px] leading-snug text-muted-foreground">
              {JSON.stringify(buildAdvisorSummary(subjects, sessions, settings, new Date()), null, 1)}
            </pre>
          ) : null}
          <Button className="w-full rounded-xl" onClick={runAi} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {loading ? "Analisando..." : "Analisar meus registros com IA"}
          </Button>
          {ai ? (
            <div className="space-y-3 pt-2">
              {ai.resumo ? <p className="rounded-xl bg-primary-soft p-3 text-sm text-foreground">{ai.resumo}</p> : null}
              <ul className="space-y-2">
                {ai.recomendacoes.map((r, i) => (
                  <li key={i} className="rounded-xl border p-3">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", TIPO_STYLE[r.tipo] ?? TIPO_STYLE["cronograma"])}>{r.tipo}</span>
                    <p className="mt-1 text-sm font-semibold">{r.titulo}</p>
                    <p className="text-sm text-muted-foreground">{r.texto}</p>
                  </li>
                ))}
              </ul>
              {ai.ajustes.length ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">Ajustes propostos para o cronograma</p>
                  <ul className="space-y-1.5">
                    {ai.ajustes.map((a, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => toggleAi(i)} className={cn("flex w-full items-start gap-3 rounded-xl border p-2.5 text-left", aiSel.has(i) && "border-primary bg-primary-soft")}>
                          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", aiSel.has(i) ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                            {aiSel.has(i) ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span className="text-sm">
                            <span className="font-semibold">{names.get(a.disciplinaId)}</span> · peso ×{a.fator.toFixed(2)} · {FOCUS_LABEL[a.foco]}
                            <span className="block text-xs text-muted-foreground">{a.motivo}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="Reorganizar cronograma">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Selecione as recomendações acima e gere uma prévia. Nada é substituído sem a sua confirmação.</p>
          <Button variant="secondary" className="w-full rounded-xl" disabled={!anySelected} onClick={buildPreview}><Wand2 /> Gerar prévia do novo cronograma</Button>
          {preview ? (
            <div className="space-y-3 rounded-2xl border p-3">
              <p className="text-sm font-semibold">Prévia: {preview.blocks.length} blocos de {preview.blockMin} min</p>
              <ul className="space-y-1">
                {changes.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 text-xs">
                    <span className="truncate">{names.get(c.id) ?? "—"}</span>
                    <span className="tabular text-muted-foreground">
                      {plan ? `${fmtMinutes(c.a)} → ` : ""}<span className={cn("font-semibold", c.b > c.a ? "text-success" : c.b < c.a ? "text-destructive" : "text-foreground")}>{fmtMinutes(c.b)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {preview.redistribute.length ? <p className="text-xs text-muted-foreground">Também redistribui revisões pendentes de: {preview.redistribute.map((id) => names.get(id)).join(", ")}.</p> : null}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setPreview(null)}>Descartar</Button>
                <Button className="flex-1 rounded-xl" onClick={() => (plan ? setConfirm(true) : apply())}><CalendarSync /> Aplicar</Button>
              </div>
            </div>
          ) : null}
          <Link to="/planejador" className="block text-center text-xs font-medium text-primary">Abrir planejador</Link>
        </div>
      </Panel>

      <Notice>
        O orientador trata apenas de organização dos estudos. Ele não recomenda alteração de dose, horário de administração ou frequência de medicamentos — essas decisões cabem ao seu médico.
      </Notice>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Substituir o planejamento existente?"
        description="O cronograma atual será trocado pela prévia gerada com as recomendações selecionadas. Os pesos ajustados também valerão para os próximos cronogramas."
        confirmLabel="Substituir"
        onConfirm={apply}
      />
    </div>
  );
}

function RecItem({ r, on, onToggle }: { r: Recommendation; on: boolean; onToggle: () => void }) {
  const actionable = r.action !== null;
  return (
    <li className={cn("rounded-xl border p-3", on && "border-primary bg-primary-soft")}>
      <div className="flex items-start gap-3">
        {actionable ? (
          <button type="button" onClick={onToggle} aria-label={on ? "Remover da reorganização" : "Incluir na reorganização"} className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background")}>
            {on ? <Check className="h-3 w-3" /> : null}
          </button>
        ) : null}
        <div className="min-w-0">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", TIPO_STYLE[r.tipo])}>{r.tipo}</span>
          <p className="mt-1 text-sm font-semibold">{r.titulo}</p>
          <p className="text-sm text-muted-foreground">{r.texto}</p>
        </div>
      </div>
    </li>
  );
}
