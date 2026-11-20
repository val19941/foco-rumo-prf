import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Panel({ className, children, title, action }: { className?: string; children: ReactNode; title?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-card", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "default" | "primary" | "warm" | "success" }) {
  const tones = {
    default: "bg-card",
    primary: "bg-primary-soft",
    warm: "bg-accent",
    success: "bg-secondary",
  } as const;
  return (
    <div className={cn("rounded-2xl border p-3.5 shadow-card", tones[tone])}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-xl font-bold tabular text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function Scale({ label, value, onChange, low = "0", high = "10", hint }: { label: string; value: number; onChange: (v: number) => void; low?: string; high?: string; hint?: string }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="min-w-10 rounded-lg bg-primary-soft px-2 py-0.5 text-center font-display text-sm font-bold tabular text-primary">{value}</span>
      </div>
      {hint ? <p className="-mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      <Slider value={[value]} min={0} max={10} step={1} onValueChange={(v) => onChange(v[0] ?? 0)} aria-label={label} />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function NumberField({ label, value, onChange, min = 0, max, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; step?: number }) {
  const clamp = (v: number) => Math.max(min, max === undefined ? v : Math.min(max, v));
  return (
    <div className="space-y-1.5">
      <label className="block truncate text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="h-10 w-10 shrink-0 rounded-xl border bg-background text-lg font-semibold text-foreground active:bg-muted" aria-label={`Diminuir ${label}`}>−</button>
        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            inputMode="numeric"
            aria-label={label}
            className="h-10 w-full rounded-xl border bg-background px-2 text-center font-display text-base font-semibold tabular text-foreground outline-none focus:ring-2 focus:ring-ring"
            value={Number.isFinite(value) ? value : 0}
            min={min}
            max={max}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          />
          {suffix ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span> : null}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + step))} className="h-10 w-10 shrink-0 rounded-xl border bg-background text-lg font-semibold text-foreground active:bg-muted" aria-label={`Aumentar ${label}`}>+</button>
      </div>
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 px-5 py-8 text-center">
      <p className="font-display font-semibold text-foreground">{title}</p>
      {text ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 11, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Bar({ value, className }: { value: number; className?: string | undefined }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full bg-primary transition-all", className)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
