import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "./dates";
import { completeReview, markLearned, prioritizeAfterErrors, redistributeReviews } from "./review";
import { createDefaultMed, createDefaultSettings, createSeedSubjects } from "./seed";
import type {
  ActiveStudy,
  AppData,
  Dose,
  ID,
  MedProfile,
  Plan,
  PlanAdjust,
  Session,
  SessionKind,
  Settings,
  Subject,
  Topic,
} from "./types";

export interface AppState extends AppData {
  active: ActiveStudy | null;
  pendingStudy: { subjectId: ID | null; topicId: ID | null; kind: SessionKind; blockId: ID | null; minutes: number } | null;
  notified: Record<string, number>;

  addSession: (s: Omit<Session, "id">, blockId?: ID | null) => void;
  deleteSession: (id: ID) => void;

  addSubject: (name: string) => ID;
  updateSubject: (id: ID, patch: Partial<Omit<Subject, "id" | "topics">>) => void;
  deleteSubject: (id: ID) => void;
  addTopic: (subjectId: ID, name: string) => void;
  updateTopic: (subjectId: ID, topicId: ID, patch: Partial<Topic>) => void;
  deleteTopic: (subjectId: ID, topicId: ID) => void;
  addSubtopic: (subjectId: ID, topicId: ID, name: string) => void;
  toggleSubtopic: (subjectId: ID, topicId: ID, subId: ID) => void;
  deleteSubtopic: (subjectId: ID, topicId: ID, subId: ID) => void;
  markTopicLearned: (subjectId: ID, topicId: ID) => void;
  reviewTopic: (subjectId: ID, topicId: ID, accuracy: number) => void;
  redistribute: (subjectId: ID) => void;

  addDose: (takenAt: Date, note?: string) => void;
  deleteDose: (id: ID) => void;
  setMed: (patch: Partial<MedProfile>) => void;

  setPlan: (plan: Plan | null) => void;
  toggleBlock: (id: ID) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setAdjustments: (adj: Record<ID, PlanAdjust>) => void;

  planStudy: (p: AppState["pendingStudy"]) => void;
  prepare: (a: Omit<ActiveStudy, "preparedAt" | "startedAt" | "pausedAt" | "pausedMs" | "interruptions">) => void;
  begin: () => void;
  pause: () => void;
  resume: () => void;
  interrupt: () => void;
  cancelActive: () => void;

  markNotified: (key: string) => void;
  importData: (d: AppData) => void;
  resetAll: () => void;
}

function initialData(): AppData {
  return {
    version: 1,
    subjects: createSeedSubjects(),
    sessions: [],
    doses: [],
    med: createDefaultMed(),
    plan: null,
    settings: createDefaultSettings(),
  };
}

function mapTopic(subjects: Subject[], sid: ID, tid: ID, f: (t: Topic) => Topic): Subject[] {
  return subjects.map((s) =>
    s.id !== sid ? s : { ...s, topics: s.topics.map((t) => (t.id === tid ? f(t) : t)) },
  );
}

function newTopic(name: string): Topic {
  return {
    id: uid(),
    name,
    subtopics: [],
    learnedAt: null,
    stage: 0,
    ease: 1,
    lastReview: null,
    nextReview: null,
    flagged: false,
    reviews: [],
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),
      active: null,
      pendingStudy: null,
      notified: {},

      addSession: (s, blockId) =>
        set((st) => {
          const session: Session = { ...s, id: uid() };
          const now = new Date(s.startedAt);
          let subjects = st.subjects;
          if (s.subjectId && s.topicId) {
            const intervals = st.settings.reviewIntervals;
            const accuracy = s.questions > 0 ? (s.correct / s.questions) * 100 : null;
            subjects = mapTopic(subjects, s.subjectId, s.topicId, (t) => {
              let next = t;
              if (s.kind === "revisao" && t.learnedAt) {
                next = completeReview(next, accuracy ?? s.diary.recall * 10, intervals, new Date());
              } else {
                next = markLearned(next, intervals, now);
              }
              if (accuracy !== null && s.questions >= 3) next = prioritizeAfterErrors(next, accuracy, new Date());
              return next;
            });
          }
          const plan =
            blockId && st.plan
              ? { ...st.plan, blocks: st.plan.blocks.map((b) => (b.id === blockId ? { ...b, done: true } : b)) }
              : st.plan;
          return { sessions: [...st.sessions, session], subjects, plan };
        }),
      deleteSession: (id) => set((st) => ({ sessions: st.sessions.filter((s) => s.id !== id) })),

      addSubject: (name) => {
        const id = uid();
        set((st) => ({
          subjects: [...st.subjects, { id, name, importance: 3, difficulty: 3, mastery: 0, topics: [] }],
        }));
        return id;
      },
      updateSubject: (id, patch) =>
        set((st) => ({ subjects: st.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
      deleteSubject: (id) =>
        set((st) => ({
          subjects: st.subjects.filter((s) => s.id !== id),
          plan: st.plan ? { ...st.plan, blocks: st.plan.blocks.filter((b) => b.subjectId !== id) } : null,
        })),
      addTopic: (sid, name) =>
        set((st) => ({
          subjects: st.subjects.map((s) => (s.id === sid ? { ...s, topics: [...s.topics, newTopic(name)] } : s)),
        })),
      updateTopic: (sid, tid, patch) =>
        set((st) => ({ subjects: mapTopic(st.subjects, sid, tid, (t) => ({ ...t, ...patch })) })),
      deleteTopic: (sid, tid) =>
        set((st) => ({
          subjects: st.subjects.map((s) => (s.id === sid ? { ...s, topics: s.topics.filter((t) => t.id !== tid) } : s)),
        })),
      addSubtopic: (sid, tid, name) =>
        set((st) => ({
          subjects: mapTopic(st.subjects, sid, tid, (t) => ({
            ...t,
            subtopics: [...t.subtopics, { id: uid(), name, done: false }],
          })),
        })),
      toggleSubtopic: (sid, tid, subId) =>
        set((st) => ({
          subjects: mapTopic(st.subjects, sid, tid, (t) => ({
            ...t,
            subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)),
          })),
        })),
      deleteSubtopic: (sid, tid, subId) =>
        set((st) => ({
          subjects: mapTopic(st.subjects, sid, tid, (t) => ({
            ...t,
            subtopics: t.subtopics.filter((x) => x.id !== subId),
          })),
        })),
      markTopicLearned: (sid, tid) =>
        set((st) => ({
          subjects: mapTopic(st.subjects, sid, tid, (t) => markLearned(t, st.settings.reviewIntervals, new Date())),
        })),
      reviewTopic: (sid, tid, accuracy) =>
        set((st) => ({
          subjects: mapTopic(st.subjects, sid, tid, (t) =>
            completeReview(t, accuracy, st.settings.reviewIntervals, new Date()),
          ),
        })),
      redistribute: (sid) =>
        set((st) => ({
          subjects: st.subjects.map((s) => (s.id === sid ? redistributeReviews(s, new Date()) : s)),
        })),

      addDose: (takenAt, note = "") =>
        set((st) => {
          const d: Dose = { id: uid(), takenAt: takenAt.toISOString(), note };
          return { doses: [...st.doses, d].slice(-500) };
        }),
      deleteDose: (id) => set((st) => ({ doses: st.doses.filter((d) => d.id !== id) })),
      setMed: (patch) => set((st) => ({ med: { ...st.med, ...patch } })),

      setPlan: (plan) => set({ plan }),
      toggleBlock: (id) =>
        set((st) =>
          st.plan
            ? { plan: { ...st.plan, blocks: st.plan.blocks.map((b) => (b.id === id ? { ...b, done: !b.done } : b)) } }
            : {},
        ),
      setSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
      setAdjustments: (adj) => set((st) => ({ settings: { ...st.settings, adjustments: adj } })),

      planStudy: (p) => set({ pendingStudy: p }),
      prepare: (a) =>
        set({
          active: {
            ...a,
            preparedAt: new Date().toISOString(),
            startedAt: null,
            pausedAt: null,
            pausedMs: 0,
            interruptions: 0,
          },
          pendingStudy: null,
        }),
      begin: () =>
        set((st) => (st.active ? { active: { ...st.active, startedAt: new Date().toISOString() } } : {})),
      pause: () =>
        set((st) =>
          st.active && !st.active.pausedAt ? { active: { ...st.active, pausedAt: new Date().toISOString() } } : {},
        ),
      resume: () =>
        set((st) => {
          const a = st.active;
          if (!a?.pausedAt) return {};
          return {
            active: { ...a, pausedAt: null, pausedMs: a.pausedMs + (Date.now() - new Date(a.pausedAt).getTime()) },
          };
        }),
      interrupt: () =>
        set((st) => (st.active ? { active: { ...st.active, interruptions: st.active.interruptions + 1 } } : {})),
      cancelActive: () => set({ active: null }),

      markNotified: (key) =>
        set((st) => {
          const cutoff = Date.now() - 3 * 86_400_000;
          const next: Record<string, number> = {};
          for (const [k, v] of Object.entries(st.notified)) if (v > cutoff) next[k] = v;
          next[key] = Date.now();
          return { notified: next };
        }),
      importData: (d) =>
        set({
          version: 1,
          subjects: d.subjects,
          sessions: d.sessions,
          doses: d.doses,
          med: { ...createDefaultMed(), ...d.med },
          plan: d.plan,
          settings: { ...createDefaultSettings(), ...d.settings },
          active: null,
        }),
      resetAll: () => set({ ...initialData(), active: null, pendingStudy: null, notified: {} }),
    }),
    {
      name: "focusstudy-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version,
        subjects: s.subjects,
        sessions: s.sessions,
        doses: s.doses,
        med: s.med,
        plan: s.plan,
        settings: s.settings,
        active: s.active,
        notified: s.notified,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          med: { ...current.med, ...(p.med ?? {}) },
        };
      },
    },
  ),
);

export function exportData(s: AppState): AppData {
  return {
    version: 1,
    subjects: s.subjects,
    sessions: s.sessions,
    doses: s.doses,
    med: s.med,
    plan: s.plan,
    settings: s.settings,
  };
}

/** Live clock that re-renders every `ms`. */
export { useNow } from "./use-now";
