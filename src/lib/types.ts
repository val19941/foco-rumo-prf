export type ID = string;

export interface Subtopic {
  id: ID;
  name: string;
  done: boolean;
}

export interface ReviewLog {
  date: string;
  accuracy: number;
}

export interface Topic {
  id: ID;
  name: string;
  subtopics: Subtopic[];
  /** When the topic was first studied (starts the spaced-review cycle). */
  learnedAt: string | null;
  /** Number of successful review steps completed. */
  stage: number;
  /** Interval multiplier adjusted by performance (0.6 – 1.5). */
  ease: number;
  lastReview: string | null;
  nextReview: string | null;
  /** Marked for priority review after errors. */
  flagged: boolean;
  reviews: ReviewLog[];
}

export interface Subject {
  id: ID;
  name: string;
  /** Importance in the edital, 1–5. */
  importance: number;
  /** Perceived difficulty, 1–5. */
  difficulty: number;
  /** Self-declared mastery, 0–10. */
  mastery: number;
  topics: Topic[];
}

export type DistractionSource = "nenhuma" | "externa" | "pensamentos" | "ambos";

export interface Diary {
  easeStart: number;
  attention: number;
  distractions: number;
  source: DistractionSource;
  comprehension: number;
  recall: number;
  finishDifficulty: number;
  energy: number;
  focusQuality: number;
}

export type SessionKind = "teoria" | "questoes" | "revisao";

export interface Session {
  id: ID;
  startedAt: string;
  subjectId: ID | null;
  topicId: ID | null;
  kind: SessionKind;
  startDelayMin: number;
  studiedMin: number;
  interruptions: number;
  questions: number;
  correct: number;
  sleep: number;
  anxiety: number;
  fatigue: number;
  diary: Diary;
  notes: string;
}

export interface Dose {
  id: ID;
  takenAt: string;
  note: string;
}

export type MedPreset = "ir" | "la" | "custom";

export interface MedProfile {
  label: string;
  preset: MedPreset;
  onsetMin: number;
  peakStartMin: number;
  peakEndMin: number;
  durationMin: number;
  /** Times registered by the user according to their prescription ("HH:MM"). */
  scheduledTimes: string[];
  reminders: boolean;
}

export interface PlanBlock {
  id: ID;
  date: string;
  order: number;
  subjectId: ID;
  topicId: ID | null;
  minutes: number;
  kind: SessionKind;
  done: boolean;
}

export interface Plan {
  generatedAt: string;
  startDate: string;
  blocks: PlanBlock[];
}

export type Focus = "teoria" | "pratica" | "equilibrado";

export interface PlanAdjust {
  factor: number;
  focus: Focus;
}

export interface NotificationSettings {
  enabled: boolean;
  medication: boolean;
  study: boolean;
  reviews: boolean;
}

export interface Settings {
  /** Minutes available per weekday, index = Date#getDay() (0 = domingo). */
  availability: number[];
  blockMin: number;
  breakMin: number;
  studyStartTime: string;
  reviewIntervals: number[];
  targetHours: number;
  targetAccuracy: number;
  examDate: string | null;
  weeklyHoursGoal: number;
  notifications: NotificationSettings;
  adjustments: Record<ID, PlanAdjust>;
}

export interface ActiveStudy {
  subjectId: ID | null;
  topicId: ID | null;
  kind: SessionKind;
  blockId: ID | null;
  preparedAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
  interruptions: number;
  targetMin: number;
}

export interface AppData {
  version: 1;
  subjects: Subject[];
  sessions: Session[];
  doses: Dose[];
  med: MedProfile;
  plan: Plan | null;
  settings: Settings;
}
