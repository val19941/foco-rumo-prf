import { fmt } from "@/lib/dates";
import { doseWindows, type PhaseKey } from "@/lib/medication";
import type { Dose, MedProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASE_BG: Record<Exclude<PhaseKey, "encerrado">, string> = {
  aguardando: "bg-phase-wait",
  inicio: "bg-phase-onset",
  pico: "bg-phase-peak",
  declinio: "bg-phase-decline",
};

export function PhaseLegend() {
  const items: [string, string][] = [
    ["bg-phase-wait", "Antes do início"],
    ["bg-phase-onset", "Início"],
    ["bg-phase-peak", "Pico"],
    ["bg-phase-decline", "Redução"],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", c)} />
          {l}
        </span>
      ))}
    </div>
  );
}

/** One dose: proportional bar of estimated phases with a "now" marker. */
export function DoseTimeline({ dose, profile, now }: { dose: Dose; profile: MedProfile; now: Date }) {
  const w = doseWindows(new Date(dose.takenAt), profile);
  const total = profile.durationMin;
  const seg = (a: number, b: number) => `${((b - a) / total) * 100}%`;
  const nowPct = ((now.getTime() - w.dose.getTime()) / 60_000 / total) * 100;
  return (
    <div>
      <div className="relative">
        <div className="flex h-4 overflow-hidden rounded-full">
          <div className={PHASE_BG.aguardando} style={{ width: seg(0, profile.onsetMin) }} />
          <div className={PHASE_BG.inicio} style={{ width: seg(profile.onsetMin, profile.peakStartMin) }} />
          <div className={PHASE_BG.pico} style={{ width: seg(profile.peakStartMin, profile.peakEndMin) }} />
          <div className={PHASE_BG.declinio} style={{ width: seg(profile.peakEndMin, profile.durationMin) }} />
        </div>
        {nowPct >= 0 && nowPct <= 100 ? (
          <div className="absolute -top-1.5 bottom-[-6px] w-0.5 rounded bg-foreground" style={{ left: `${nowPct}%` }}>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-foreground">agora</span>
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular text-muted-foreground">
        <span>{fmt(w.dose, "HH:mm")}</span>
        <span>pico {fmt(w.peakStart, "HH:mm")}–{fmt(w.peakEnd, "HH:mm")}</span>
        <span>{fmt(w.end, "HH:mm")}</span>
      </div>
    </div>
  );
}

/** Day overview 06h–24h with every dose's estimated windows. */
export function DayStrip({ doses, profile, day, now }: { doses: Dose[]; profile: MedProfile; day: Date; now: Date }) {
  const start = new Date(day);
  start.setHours(6, 0, 0, 0);
  const span = 18 * 60;
  const pos = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - start.getTime()) / 60_000 / span) * 100));
  const todays = doses.filter((d) => new Date(d.takenAt).toDateString() === day.toDateString());
  const nowPct = pos(now);
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-xl bg-phase-off">
        {todays.map((d) => {
          const w = doseWindows(new Date(d.takenAt), profile);
          const parts: [Date, Date, string][] = [
            [w.dose, w.onset, PHASE_BG.aguardando],
            [w.onset, w.peakStart, PHASE_BG.inicio],
            [w.peakStart, w.peakEnd, PHASE_BG.pico],
            [w.peakEnd, w.end, PHASE_BG.declinio],
          ];
          return parts.map(([a, b, c], i) => (
            <div key={`${d.id}-${i}`} className={cn("absolute inset-y-0 opacity-90", c)} style={{ left: `${pos(a)}%`, width: `${pos(b) - pos(a)}%` }} />
          ));
        })}
        {now.toDateString() === day.toDateString() && nowPct > 0 && nowPct < 100 ? (
          <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${nowPct}%` }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular text-muted-foreground">
        {["6h", "9h", "12h", "15h", "18h", "21h", "24h"].map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}
