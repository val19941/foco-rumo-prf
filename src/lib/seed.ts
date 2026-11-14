import type { MedProfile, Settings, Subject, Topic } from "./types";

function topic(id: string, name: string, subs: string[] = []): Topic {
  return {
    id,
    name,
    subtopics: subs.map((s, i) => ({ id: `${id}-s${i + 1}`, name: s, done: false })),
    learnedAt: null,
    stage: 0,
    ease: 1,
    lastReview: null,
    nextReview: null,
    flagged: false,
    reviews: [],
  };
}

function subject(
  id: string,
  name: string,
  importance: number,
  difficulty: number,
  topics: [string, string[]?][],
): Subject {
  return {
    id,
    name,
    importance,
    difficulty,
    mastery: 3,
    topics: topics.map(([n, s], i) => topic(`${id}-t${i + 1}`, n, s ?? [])),
  };
}

/** Initial PRF disciplines. Deterministic IDs (no randomness at module scope). */
export function createSeedSubjects(): Subject[] {
  return [
    subject("portugues", "Língua Portuguesa", 5, 3, [
      ["Interpretação de texto", ["Compreensão", "Inferência", "Tipologia textual"]],
      ["Ortografia e acentuação"],
      ["Classes de palavras"],
      ["Sintaxe da oração e do período", ["Termos da oração", "Coordenação e subordinação"]],
      ["Concordância e regência"],
      ["Crase"],
      ["Pontuação"],
    ]),
    subject("transito", "Legislação de Trânsito", 5, 3, [
      ["CTB — Disposições gerais e SNT"],
      ["Normas gerais de circulação e conduta"],
      ["Sinalização de trânsito"],
      ["Veículos e registro/licenciamento"],
      ["Habilitação"],
      ["Infrações e penalidades", ["Gravidade das infrações", "Medidas administrativas"]],
      ["Crimes de trânsito"],
      ["Resoluções do CONTRAN"],
    ]),
    subject("constitucional", "Direito Constitucional", 4, 3, [
      ["Princípios fundamentais"],
      ["Direitos e garantias fundamentais", ["Art. 5º", "Remédios constitucionais"]],
      ["Organização do Estado"],
      ["Administração Pública (arts. 37–41)"],
      ["Segurança pública (art. 144)"],
    ]),
    subject("administrativo", "Direito Administrativo", 3, 3, [
      ["Princípios da Administração"],
      ["Atos administrativos"],
      ["Poderes administrativos"],
      ["Agentes públicos e Lei 8.112/90"],
      ["Improbidade administrativa"],
      ["Responsabilidade civil do Estado"],
    ]),
    subject("penal", "Direito Penal", 4, 4, [
      ["Aplicação da lei penal"],
      ["Teoria do crime"],
      ["Crimes contra a pessoa"],
      ["Crimes contra o patrimônio"],
      ["Crimes contra a Administração Pública"],
    ]),
    subject("processual-penal", "Direito Processual Penal", 3, 4, [
      ["Inquérito policial"],
      ["Prova"],
      ["Prisão e medidas cautelares", ["Prisão em flagrante", "Prisão preventiva e temporária"]],
      ["Ação penal"],
    ]),
    subject("direitos-humanos", "Direitos Humanos", 3, 2, [
      ["Teoria geral dos direitos humanos"],
      ["Declaração Universal dos Direitos Humanos"],
      ["Pacto de San José da Costa Rica"],
    ]),
    subject("legislacao-especial", "Legislação Especial", 4, 4, [
      ["Lei de Drogas (11.343/06)"],
      ["Estatuto do Desarmamento (10.826/03)"],
      ["Abuso de autoridade (13.869/19)"],
      ["Crimes hediondos (8.072/90)"],
      ["ECA — aspectos penais"],
      ["Lei Maria da Penha"],
    ]),
    subject("rlm", "Raciocínio Lógico-Matemático", 3, 4, [
      ["Proposições e conectivos"],
      ["Equivalências e negações"],
      ["Análise combinatória"],
      ["Probabilidade"],
      ["Porcentagem e razão/proporção"],
    ]),
    subject("informatica", "Informática", 3, 3, [
      ["Redes e internet"],
      ["Segurança da informação"],
      ["Sistemas operacionais"],
      ["Aplicativos de escritório"],
      ["Computação em nuvem"],
    ]),
    subject("fisica", "Física", 3, 4, [
      ["Cinemática", ["MRU", "MRUV"]],
      ["Dinâmica — Leis de Newton"],
      ["Trabalho, energia e potência"],
      ["Quantidade de movimento e colisões"],
    ]),
    subject("etica", "Ética no Serviço Público", 2, 2, [
      ["Ética e moral"],
      ["Decreto 1.171/94"],
      ["Lei de Acesso à Informação"],
    ]),
  ];
}

export const MED_PRESETS = {
  ir: {
    name: "Liberação imediata",
    onsetMin: 30,
    peakStartMin: 60,
    peakEndMin: 120,
    durationMin: 240,
  },
  la: {
    name: "Liberação prolongada (LA)",
    onsetMin: 45,
    peakStartMin: 90,
    peakEndMin: 300,
    durationMin: 480,
  },
} as const;

export function createDefaultMed(): MedProfile {
  return {
    label: "Metilfenidato",
    preset: "ir",
    ...pickPreset("ir"),
    scheduledTimes: [],
    reminders: false,
  };
}

export function pickPreset(p: "ir" | "la") {
  const { onsetMin, peakStartMin, peakEndMin, durationMin } = MED_PRESETS[p];
  return { onsetMin, peakStartMin, peakEndMin, durationMin };
}

export function createDefaultSettings(): Settings {
  return {
    availability: [120, 240, 240, 240, 240, 240, 180],
    blockMin: 50,
    breakMin: 10,
    studyStartTime: "08:00",
    reviewIntervals: [1, 7, 15, 30],
    targetHours: 800,
    targetAccuracy: 80,
    examDate: null,
    weeklyHoursGoal: 20,
    notifications: { enabled: false, medication: true, study: true, reviews: true },
    adjustments: {},
  };
}
