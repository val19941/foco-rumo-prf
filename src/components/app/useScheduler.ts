import { useEffect } from "react";
import { dayKey } from "@/lib/dates";
import { doseWindows, PHASE_LABEL } from "@/lib/medication";
import { notify } from "@/lib/notifications";
import { pendingReviews } from "@/lib/review";
import { useApp } from "@/lib/store";

const WINDOW_MS = 10 * 60_000;

function atToday(hhmm: string, now: Date) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** Checks scheduled events while the app is open and fires each one once. */
export function useScheduler() {
  useEffect(() => {
    const tick = () => {
      const st = useApp.getState();
      const n = st.settings.notifications;
      if (!n.enabled) return;
      const now = new Date();
      const t = now.getTime();
      const due = (key: string, at: Date) => {
        const d = t - at.getTime();
        return d >= 0 && d < WINDOW_MS && !st.notified[key];
      };
      const fire = (key: string, title: string, body: string, url = "/") => {
        st.markNotified(key);
        void notify(title, body, { tag: key, url });
      };

      if (n.medication) {
        for (const dose of st.doses) {
          const w = doseWindows(new Date(dose.takenAt), st.med);
          if (t - w.dose.getTime() > 16 * 3600_000) continue;
          const events: [string, Date, string][] = [
            ["inicio", w.onset, `${PHASE_LABEL.inicio}. Referência aproximada — boa hora para começar pelo aquecimento.`],
            ["pico", w.peakStart, `${PHASE_LABEL.pico}. Referência aproximada para tarefas mais exigentes.`],
            ["declinio", w.peakEnd, `${PHASE_LABEL.declinio}. Considere revisões e tarefas mais leves.`],
            ["fim", w.end, `${PHASE_LABEL.encerrado}.`],
          ];
          for (const [k, at, body] of events) {
            const key = `med-${dose.id}-${k}`;
            if (due(key, at)) fire(key, "Linha do tempo estimada", body, "/medicacao");
          }
        }
        if (st.med.reminders) {
          for (const time of st.med.scheduledTimes) {
            const key = `medtime-${dayKey(now)}-${time}`;
            if (due(key, atToday(time, now)))
              fire(key, "Lembrete do seu horário registrado", `Horário cadastrado por você: ${time}. Registre a tomada no app quando ocorrer.`, "/medicacao");
          }
        }
      }

      const startAt = atToday(st.settings.studyStartTime, now);
      if (n.study) {
        const today = dayKey(now);
        const blocks = st.plan?.blocks.filter((b) => b.date === today && !b.done) ?? [];
        const key = `study-${today}`;
        if (blocks.length && due(key, startAt))
          fire(key, "Hora de estudar", `Você tem ${blocks.length} bloco(s) planejado(s) para hoje.`, "/planejador");
      }
      if (n.reviews) {
        const key = `reviews-${dayKey(now)}`;
        const pend = pendingReviews(st.subjects, now).length;
        if (pend && due(key, startAt))
          fire(key, "Revisões do dia", `${pend} revisão(ões) aguardando você.`, "/revisoes");
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);
}
