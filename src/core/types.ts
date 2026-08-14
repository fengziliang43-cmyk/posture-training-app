export type PainScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EnergyScore = 1 | 2 | 3 | 4 | 5;
export type PlanType = "full" | "reduced" | "recovery";
export type TimeVersion = "compressed" | "short" | "full";
export type ExerciseCategory = "pull" | "scapula" | "core" | "hips" | "recovery";
export type ExerciseRole =
  | "reset"
  | "mobility"
  | "upper-pull"
  | "scapular-control"
  | "core-anti-extension"
  | "core-anti-rotation"
  | "hip-stability"
  | "lower-body"
  | "conditioning"
  | "cooldown";
export type ExerciseEquipment =
  | "bodyweight"
  | "floor"
  | "pull-up-bar"
  | "resistance-band"
  | "wall"
  | "step"
  | "walking-space";
export type LoadLevel = 0 | 1 | 2 | 3;
export type ExerciseDifficulty = 1 | 2 | 3;
export type ExerciseCompletionStatus = "completed" | "partial" | "skipped";
export type ExerciseFeedback = "none" | "time" | "fatigue" | "pain" | "technique";
export type ProgressionState = "baseline" | "maintain" | "progressed" | "regressed" | "deloaded";
export type AgeRange = "18-29" | "30-44" | "45-59" | "60+";
export type FitnessLevel = "beginner" | "regular" | "experienced";
export type TrainingGoal = "safe-movement" | "posture" | "fat-loss" | "strength" | "conditioning";
export type FunctionalLimitation = "low-back" | "shoulder" | "knee" | "balance";

export interface TrainingProfile {
  ageRange: AgeRange;
  heightCm?: number;
  weightKg?: number;
  fitnessLevel: FitnessLevel;
  goals: TrainingGoal[];
  equipment: ExerciseEquipment[];
  weeklyTrainingDays: number;
  defaultSessionMinutes: number;
  canWalk20Minutes: boolean;
  canChairStand: boolean;
  canHoldSupport20Seconds: boolean;
  limitations: FunctionalLimitation[];
  baselineLowBackPain?: PainScore;
  baselineNeckShoulderPain?: PainScore;
  onboardingVersion: string;
  completedAt?: string;
}

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
  videoUrl: string;
  videoSource: string;
  roles: ExerciseRole[];
  equipment: ExerciseEquipment[];
  allowedPlanTypes: PlanType[];
  difficulty: ExerciseDifficulty;
  load: {
    lowBack: LoadLevel;
    shoulder: LoadLevel;
    knee: LoadLevel;
    balance: LoadLevel;
    impact: LoadLevel;
  };
  goals: {
    posture: LoadLevel;
    strength: LoadLevel;
    fatLoss: LoadLevel;
    conditioning: LoadLevel;
  };
  progression: {
    repsStep?: number;
    secondsStep?: number;
    maxReps?: number;
    maxSeconds?: number;
    maxSets: number;
    minSets: number;
  };
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

export type AdaptiveTemplateId = "adaptive-balanced" | "adaptive-reduced" | "adaptive-recovery";
export type PlanTemplateId = TrainingTemplate["id"] | AdaptiveTemplateId;

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
  videoUrl?: string;
  videoSource?: string;
  slot?: ExerciseRole;
  selectionReason?: string;
  estimatedMinutes?: number;
  progressionState?: ProgressionState;
}

export interface ExerciseResult {
  exerciseId: string;
  exerciseIndex: number;
  completionStatus: ExerciseCompletionStatus;
  feedback: ExerciseFeedback;
}

export interface TrainingHistorySession {
  date: string;
  planType: PlanType;
  templateId: PlanTemplateId;
  exercises: GeneratedExercise[];
  completionStatus: ExerciseCompletionStatus;
  lowBackPainBefore?: number;
  lowBackPainAfter?: number;
  exerciseResults: ExerciseResult[];
}

export interface TrainingHistory {
  sessions: TrainingHistorySession[];
  trainingStartDate?: string;
}

export interface PlanDecision {
  readinessScore: number;
  volumeMultiplier: number;
  focusLabel: string;
  reasons: string[];
  avoidedReasons: string[];
  cycleWeek: number;
}

export interface GeneratedPlan {
  date: string;
  type: PlanType;
  timeVersion: TimeVersion;
  templateId: PlanTemplateId;
  reason: string;
  exercises: GeneratedExercise[];
  safetyMessage?: string;
  algorithmVersion: string;
  estimatedMinutes: number;
  decision: PlanDecision;
}
