export type PainScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EnergyScore = 1 | 2 | 3 | 4 | 5;
export type PlanType = "full" | "reduced" | "recovery";
export type TimeVersion = "compressed" | "short" | "full";
export type ExerciseCategory = "pull" | "scapula" | "core" | "hips" | "recovery";

export interface DailyStatus {
  date: string;
  lowBackPain: PainScore;
  neckShoulderPain?: PainScore;
  energy: EnergyScore;
  availableMinutes: number;
  sleepHours?: number;
  sleepQuality?: EnergyScore;
  steps?: number;
  eatingStatus?: "poor" | "normal" | "good";
  weightKg?: number;
  redFlags?: {
    legNumbness?: boolean;
    radiatingPain?: boolean;
    weakness?: boolean;
    bowelBladderChange?: boolean;
    sharpSuddenPain?: boolean;
  };
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultSets: number;
  defaultReps?: number;
  defaultSeconds?: number;
  restSeconds: number;
  coachingNotes: string[];
  replacementId?: string;
  stopCondition: string;
}

export interface TemplateBlock {
  label: string;
  exerciseIds: string[];
}

export interface TrainingTemplate {
  id: "upper-back-core" | "glute-pelvis" | "full-body-light" | "recovery";
  name: string;
  type: PlanType;
  blocks: TemplateBlock[];
}

export interface GeneratedExercise {
  exerciseId: string;
  replacedFromId?: string;
  name: string;
  sets: number;
  reps?: number;
  seconds?: number;
  restSeconds: number;
  notes: string[];
  replacementId?: string;
  stopCondition: string;
}

export interface GeneratedPlan {
  date: string;
  type: PlanType;
  timeVersion: TimeVersion;
  templateId: TrainingTemplate["id"];
  reason: string;
  exercises: GeneratedExercise[];
  safetyMessage?: string;
}
