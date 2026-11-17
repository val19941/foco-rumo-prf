import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpenCheck,
  CalendarDays,
  Database,
  LayoutDashboard,
  LineChart,
  Menu,
  NotebookPen,
  Pill,
  Repeat,
  Shield,
  Sparkles,
  Timer,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { pendingReviews } from "@/lib/review";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useScheduler } from "./useScheduler";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/estudar", label: "Modo estudo", icon: Timer },
  { to: "/planejador", label: "Planejador", icon: CalendarDays },
  { to: "/medicacao", label: "Medicação", icon: Pill },
  { to: "/revisoes", label: "Revisões", icon: Repeat },
  { to: "/prf", label: "Preparação PRF", icon: Shield },
  { to: "/diario", label: "Diário de Concentração", icon: NotebookPen },
  { to: "/desempenho", label: "Meu Desempenho", icon: LineChart },
  { to: "/orientador", label: "Orientador de Estudos", icon: Sparkles },
  { to: "/dados", label: "Dados e ajustes", icon: Database },
] as const;

const BOTTOM = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/planejador", label: "Plano", icon: CalendarDays },
  { to: "/estudar", label: "Estudar", icon: Timer },
  { to: "/medicacao", label: "Medicação", icon: Pill },
] as const;

function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  useScheduler();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const subjects = useApp((s) => s.subjects);
  const active = useApp((s) => s.active);
  const pending = pendingReviews(subjects, new Date()).length;
  const [open, setOpen] = useState(false);

  const badge = (to: string) =>
    to === "/revisoes" && pending > 0 ? (
      <span className="ml-auto rounded-full bg-highlight px-1.5 text-[11px] font-bold text-highlight-foreground">{pending}</span>
    ) : to === "/estudar" && active ? (
      <span className="ml-auto h-2 w-2 rounded-full bg-success" />
    ) : null;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(path, n.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              {badge(n.to)}
            </Link>
          ))}
        </nav>
        <p className="px-3 text-[11px] leading-snug text-muted-foreground">Dados salvos apenas neste dispositivo.</p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          {active ? (
            <Link to="/estudar" className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success-foreground" /> Sessão ativa
            </Link>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {BOTTOM.map((n) => {
            const on = isActive(path, n.to);
            return (
              <Link key={n.to} to={n.to} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", on ? "text-primary" : "text-muted-foreground")}>
                {n.to === "/estudar" ? (
                  <span className={cn("-mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-float", active && "animate-pulse-ring")}>
                    <n.icon className="h-5 w-5" />
                  </span>
                ) : (
                  <n.icon className="h-5 w-5" />
                )}
                {n.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground">
            <Menu className="h-5 w-5" />
            Mais
            {pending > 0 ? <span className="absolute right-5 top-1.5 h-2 w-2 rounded-full bg-highlight" /> : null}
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left font-display">Todos os módulos</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium",
                  isActive(path, n.to) ? "border-primary bg-primary-soft text-primary" : "bg-card text-foreground",
                )}
              >
                <n.icon className="h-5 w-5" />
                <span className="leading-tight">{n.label}</span>
                {n.to === "/revisoes" && pending > 0 ? (
                  <span className="absolute right-2 top-2 rounded-full bg-highlight px-1.5 text-[10px] font-bold text-highlight-foreground">{pending}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-hero text-primary-foreground">
        <BookOpenCheck className="h-4 w-4" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-foreground">FocusStudy</span>
    </Link>
  );
}
