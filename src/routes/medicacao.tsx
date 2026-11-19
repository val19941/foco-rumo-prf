import { createFileRoute } from "@tanstack/react-router";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chips, Notice, NumberField, PageHeader, Panel } from "@/components/app/kit";
import { MedStatus } from "@/components/app/MedStatus";
import { DayStrip, PhaseLegend } from "@/components/app/MedTimeline";
import { fmt, fmtMinutes } from "@/lib/dates";
import { doseWindows, validateProfile } from "@/lib/medication";
import { MED_PRESETS, pickPreset } from "@/lib/seed";
import { useApp, useNow } from "@/lib/store";
import type { MedPreset } from "@/lib/types";

export const Route = createFileRoute("/medicacao")({
  head: () => ({
    meta: [
      { title: "Medicação e linha do tempo — FocusStudy" },
      { name: "description", content: "Registre as tomadas e veja os períodos estimados de efeito como referência para organizar os estudos." },
      { property: "og:title", content: "Medicação e linha do tempo — FocusStudy" },
      { property: "og:description", content: "Cronômetro e linha do tempo estimada para organizar seus blocos de estudo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MedPage,
});

function nowHHMM() {
  return fmt(new Date(), "HH:mm");
}

function MedPage() {
  const now = useNow(30_000);
  const med = useApp((s) => s.med);
  const doses = useApp((s) => s.doses);
  const setMed = useApp((s) => s.setMed);
  const addDose = useApp((s) => s.addDose);
  const deleteDose = useApp((s) => s.deleteDose);
  const notif = useApp((s) => s.settings.notifications);

  const [time, setTime] = useState(nowHHMM);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState({
    onsetMin: med.onsetMin,
    peakStartMin: med.peakStartMin,
    peakEndMin: med.peakEndMin,
    durationMin: med.durationMin,
  });
  const [newTime, setNewTime] = useState("08:00");
  const error = validateProfile(draft);

  const history = [...doses].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 20);

  const register = () => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    if (d.getTime() > Date.now() + 60_000) {
      toast.error("O horário não pode estar no futuro.");
      return;
    }
    addDose(d, note.trim());
    setNote("");
    toast.success("Tomada registrada", { description: `Às ${fmt(d, "HH:mm")}` });
  };

  const choosePreset = (p: MedPreset) => {
    if (p === "custom") {
      setMed({ preset: "custom" });
      return;
    }
    const v = pickPreset(p);
    setDraft(v);
    setMed({ preset: p, ...v });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Medicação" subtitle="Cronômetro e linha do tempo estimada para organizar os estudos." />

      <MedStatus />

      <Panel title="Hoje" action={<PhaseLegend />}>
        <DayStrip doses={doses} profile={med} day={now} now={now} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Registrar tomada">
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl text-base" aria-label="Horário da tomada" />
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setTime(nowHHMM())}>Agora</Button>
            </div>
            <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-11 rounded-xl" />
            <Button className="h-11 w-full rounded-xl" onClick={register}><Plus /> Registrar tomada</Button>
          </div>
        </Panel>

        <Panel title="Histórico recente">
          {history.length ? (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {history.map((d) => {
                const w = doseWindows(new Date(d.takenAt), med);
                return (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tabular">{fmt(d.takenAt, "EEE dd/MM · HH:mm")}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Pico estimado {fmt(w.peakStart, "HH:mm")}–{fmt(w.peakEnd, "HH:mm")} · fim ≈ {fmt(w.end, "HH:mm")}
                        {d.note ? ` · ${d.note}` : ""}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={() => deleteDose(d.id)}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tomada registrada.</p>
          )}
        </Panel>
      </div>

      <Panel title="Perfil da linha do tempo">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome exibido</label>
            <Input value={med.label} onChange={(e) => setMed({ label: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Formulação (referência)</label>
            <Chips<MedPreset>
              value={med.preset}
              onChange={choosePreset}
              options={[
                { value: "ir", label: MED_PRESETS.ir.name },
                { value: "la", label: MED_PRESETS.la.name },
                { value: "custom", label: "Personalizado" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Início estimado" suffix="min" step={5} value={draft.onsetMin} onChange={(v) => setDraft({ ...draft, onsetMin: v })} />
            <NumberField label="Começo do pico" suffix="min" step={5} value={draft.peakStartMin} onChange={(v) => setDraft({ ...draft, peakStartMin: v })} />
            <NumberField label="Fim do pico" suffix="min" step={15} value={draft.peakEndMin} onChange={(v) => setDraft({ ...draft, peakEndMin: v })} />
            <NumberField label="Duração total" suffix="min" step={15} value={draft.durationMin} onChange={(v) => setDraft({ ...draft, durationMin: v })} />
          </div>
          <p className="text-xs text-muted-foreground">Duração total: {fmtMinutes(draft.durationMin)} após a tomada.</p>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button
            className="rounded-xl"
            disabled={!!error}
            onClick={() => {
              setMed({ ...draft, preset: "custom" });
              toast.success("Linha do tempo atualizada");
            }}
          >
            Salvar valores personalizados
          </Button>
          <Notice>
            Os valores padrão são referências genéricas e aproximadas; a resposta varia de pessoa para pessoa. Use os
            valores que você observa ou que foram indicados pelo seu médico. O app não sugere doses, horários nem frequência
            de uso.
          </Notice>
        </div>
      </Panel>

      <Panel title="Horários registrados (conforme sua prescrição)">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {med.scheduledTimes.length ? (
              med.scheduledTimes.map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full border bg-background py-1 pl-3 pr-1 text-sm font-semibold tabular">
                  {t}
                  <button type="button" aria-label={`Remover ${t}`} className="rounded-full p-1 text-muted-foreground hover:bg-muted" onClick={() => setMed({ scheduledTimes: med.scheduledTimes.filter((x) => x !== t) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum horário cadastrado.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-11 rounded-xl" aria-label="Novo horário" />
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                if (!newTime || med.scheduledTimes.includes(newTime)) return;
                setMed({ scheduledTimes: [...med.scheduledTimes, newTime].sort() });
              }}
            >
              <Plus /> Adicionar
            </Button>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" /> Lembrar nesses horários</span>
            <Switch checked={med.reminders} onCheckedChange={(v) => setMed({ reminders: v })} />
          </label>
          {!notif.enabled ? <Notice>Ative as notificações em “Dados e ajustes” para receber lembretes.</Notice> : null}
        </div>
      </Panel>
    </div>
  );
}
