import type { PlanResponse } from "./api";

const OFFLINE_ACTIONS_KEY = "posture-training.offline-actions";
const CACHED_TODAY_PLAN_KEY = "posture-training.cached-today-plan";

export interface OfflineWorkoutCompletion {
  id: string;
  type: "completeWorkout";
  createdAt: string;
  payload: {
    planId: number;
    completionStatus: string;
    notes?: string;
    lowBackPainAfter?: number;
  };
}

export type OfflineAction = OfflineWorkoutCompletion;

export interface OfflineApiClient {
  completeWorkout: (
    planId: number,
    payload: OfflineWorkoutCompletion["payload"]
  ) => Promise<unknown>;
}

export function cacheTodayPlan(planResponse: PlanResponse): void {
  localStorage.setItem(CACHED_TODAY_PLAN_KEY, JSON.stringify(planResponse));
}

export function getCachedTodayPlan(date?: string): PlanResponse | null {
  const raw = localStorage.getItem(CACHED_TODAY_PLAN_KEY);
  if (!raw) return null;

  try {
    const cached = JSON.parse(raw) as PlanResponse;
    if (date && cached.plan.date !== date) return null;
    return cached;
  } catch {
    localStorage.removeItem(CACHED_TODAY_PLAN_KEY);
    return null;
  }
}

export function queueOfflineAction(action: Omit<OfflineAction, "id" | "createdAt">): OfflineAction {
  const nextAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  const actions = readOfflineActions();
  actions.push(nextAction);
  writeOfflineActions(actions);
  return nextAction;
}

export async function flushOfflineActions(apiClient: OfflineApiClient): Promise<number> {
  const actions = readOfflineActions();
  const remaining: OfflineAction[] = [];
  let flushed = 0;

  for (const action of actions) {
    try {
      await apiClient.completeWorkout(action.payload.planId, action.payload);
      flushed += 1;
    } catch {
      remaining.push(action);
    }
  }

  writeOfflineActions(remaining);
  return flushed;
}

export function readOfflineActions(): OfflineAction[] {
  const raw = localStorage.getItem(OFFLINE_ACTIONS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as OfflineAction[];
  } catch {
    localStorage.removeItem(OFFLINE_ACTIONS_KEY);
    return [];
  }
}

function writeOfflineActions(actions: OfflineAction[]): void {
  localStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(actions));
}
