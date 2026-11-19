import { Link } from "@tanstack/react-router";
import { Pill, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/dates";
import { currentDose, PHASE_HINT, PHASE_LABEL, phaseAt } from "@/lib/medication";
import { useApp, useNow } from "@/lib/store";
import { DoseTimeline, PhaseLegend } from "./MedTimeline";
import { toast } from "sonner";

export function countdown(to: Date, now: Date) {
  const s = Math.max(0, Math.round((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}

export function MedStatus({ compact = false }: { compact?: boolean }) {
  const now = useNow(1000);
  const doses = useApp((s) => s.doses);
  const med = useApp((s) => s.med);
  const addDose = useApp((s) => s.addDose);
  const dose = currentDose(doses, med, now);
  const info = dose ? phaseAt(new Date(dose.takenAt), med, now) : null;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Pill className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Linha do tempo estimada · {med.label}</p>
            <p className="font-display text-base font-bold text-foreground">{info ? info.label : "Nenhuma tomada registrada hoje"}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl"
          onClick={() => {
            addDose(new Date());
            toast.success("Tomada registrada", { description: `Às ${fmt(new Date(), "HH:mm")}` });
          }}
        >
          <Plus /> Registrar
        </Button>
      </div>

      {dose && info ? (
        <div className="mt-5 space-y-3">
          <DoseTimeline dose={dose} profile={med} now={now} />
          {info.nextAt && info.nextKey ? (
            <p className="text-sm text-foreground">
              <span className="font-semibold tabular">{countdown(info.nextAt, now)}</span>{" "}
              <span className="text-muted-foreground">até: {PHASE_LABEL[info.nextKey].toLowerCase()} (≈ {fmt(info.nextAt, "HH:mm")})</span>
            </p>
          ) : null}
          {!compact ? <p className="text-sm text-muted-foreground">{PHASE_HINT[info.key]}</p> : null}
          {!compact ? <PhaseLegend /> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Registre a tomada para ver os períodos estimados e organizar seus blocos de estudo.{" "}
          <Link to="/medicacao" className="font-medium text-primary underline-offset-2 hover:underline">Configurar</Link>
        </p>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Referência aproximada para organizar os estudos — não é garantia de desempenho nem orientação médica.
      </p>
    </div>
  );
}
