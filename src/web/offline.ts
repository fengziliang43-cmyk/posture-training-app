import type { ExerciseResult } from "../core/types";
import type { PlanResponse } from "./api";

/*
 * What this browser keeps for offline use belongs to one account at a time. Every key carries the
 * account id, so whoever signs in next on the same device never reads the previous person's plan or
 * sends their unsynced records. Callers that wait on the network capture the account first and pass
 * it in, so an answer that arrives after the account changed is never filed under the next account.
 */
const PREFIX = "posture-training";
const LEGACY_CACHED_TODAY_PLAN_KEY = `${PREFIX}.cached-today-plan`;
const LEGACY_OFFLINE_ACTIONS_KEY = `${PREFIX}.offline-actions`;
const LEGACY_EXERCISE_FEEDBACK_KEY = /^posture-training\.exercise-feedback\.\d+$/;
/** Until 1.0.6 the service worker kept /api/plans/today here for whoever was signed in. */
export const LEGACY_PLAN_CACHE_NAME = "posture-training-plan-v1";

export interface OfflineWorkoutCompletion {
  id: string;
  type: "completeWorkout";
  createdAt: string;
  payload: {
    planId: number;
    completionStatus: string;
    notes?: string;
    lowBackPainAfter?: number;
    exerciseResults?: ExerciseResult[];
  };
}

export type OfflineAction = OfflineWorkoutCompletion;

export interface OfflineApiClient {
  completeWorkout: (
    planId: number,
    payload: OfflineWorkoutCompletion["payload"]
  ) => Promise<unknown>;
  /** True when sending again can never work, e.g. the plan does not belong to the signed-in account. */
  isPermanentFailure?: (error: unknown) => boolean;
}

let activeAccount: number | null = null;

/** Called whenever the signed-in account changes (null when signed out). */
export function setOfflineAccount(account: number | null): void {
  activeAccount = account;
  if (account !== null) {
    adoptLegacyOfflineData(account);
    clearOtherAccountsOfflineData(account);
  }
  void deleteLegacyPlanCache();
}

export function getOfflineAccount(): number | null {
  return activeAccount;
}

export function exerciseFeedbackKey(account: number, planId: number): string {
  return `${accountPrefix(account)}exercise-feedback.${planId}`;
}

export function cacheTodayPlan(planResponse: PlanResponse, account: number | null = activeAccount): void {
  if (account === null) return;
  localStorage.setItem(planKey(account), JSON.stringify(planResponse));
}

export function getCachedTodayPlan(date?: string, account: number | null = activeAccount): PlanResponse | null {
  if (account === null) return null;
  const raw = localStorage.getItem(planKey(account));
  if (!raw) return null;

  try {
    const cached = JSON.parse(raw) as PlanResponse;
    if (date && cached.plan.date !== date) return null;
    return cached;
  } catch {
    localStorage.removeItem(planKey(account));
    return null;
  }
}

/**
 * Signing out removes the account's cached plan and in-progress exercise notes from this device.
 * Records that have not reached the server stay under the account's own key, where no other
 * account looks, and are sent the next time this account signs in here; deleting the account
 * removes them too.
 */
export function clearAccountOfflineData(account: number | null, options: { keepUnsynced: boolean }): void {
  if (account === null) return;
  try {
    const prefix = accountPrefix(account);
    for (const key of storageKeys()) {
      if (!key.startsWith(prefix)) continue;
      if (options.keepUnsynced && key === actionsKey(account)) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data); there is nothing to clear then.
  }
}

/** Returns null when no account is signed in, so nothing is queued under nobody's name. */
export function queueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt">,
  account: number | null = activeAccount
): OfflineAction | null {
  if (account === null) return null;
  const nextAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  const actions = readOfflineActions(account);
  actions.push(nextAction);
  writeOfflineActions(account, actions);
  return nextAction;
}

export async function flushOfflineActions(
  apiClient: OfflineApiClient,
  account: number | null = activeAccount
): Promise<number> {
  if (account === null) return 0;
  const actions = readOfflineActions(account);
  if (actions.length === 0) return 0;
  const remaining: OfflineAction[] = [];
  let flushed = 0;

  for (const action of actions) {
    try {
      await apiClient.completeWorkout(action.payload.planId, action.payload);
      flushed += 1;
    } catch (error) {
      if (!apiClient.isPermanentFailure?.(error)) remaining.push(action);
    }
  }

  writeOfflineActions(account, remaining);
  return flushed;
}

export function readOfflineActions(account: number | null = activeAccount): OfflineAction[] {
  if (account === null) return [];
  const raw = localStorage.getItem(actionsKey(account));
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineAction[]) : [];
  } catch {
    localStorage.removeItem(actionsKey(account));
    return [];
  }
}

/** Removes the service worker's old plan cache, which every account on this device shared. */
export async function deleteLegacyPlanCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(LEGACY_PLAN_CACHE_NAME).catch(() => false);
}

function accountPrefix(account: number): string {
  return `${PREFIX}.u${account}.`;
}

function planKey(account: number): string {
  return `${accountPrefix(account)}cached-today-plan`;
}

function actionsKey(account: number): string {
  return `${accountPrefix(account)}offline-actions`;
}

function writeOfflineActions(account: number, actions: OfflineAction[]): void {
  if (actions.length === 0) {
    localStorage.removeItem(actionsKey(account));
  } else {
    localStorage.setItem(actionsKey(account), JSON.stringify(actions));
  }
}

/**
 * Data written before keys carried the account id (Zixu 1.0.6 and earlier) cannot be told apart by
 * owner. The cached plan and in-progress exercise notes are only conveniences, so they are dropped.
 * Unsynced workout records go to the first account that signs in: the server only accepts a record
 * for that account's own plan, and one for someone else's plan is dropped on the first try.
 */
function adoptLegacyOfflineData(account: number): void {
  try {
    localStorage.removeItem(LEGACY_CACHED_TODAY_PLAN_KEY);
    for (const key of storageKeys()) {
      if (LEGACY_EXERCISE_FEEDBACK_KEY.test(key)) localStorage.removeItem(key);
    }
    const raw = localStorage.getItem(LEGACY_OFFLINE_ACTIONS_KEY);
    if (raw === null) return;
    localStorage.removeItem(LEGACY_OFFLINE_ACTIONS_KEY);
    const legacy: unknown = JSON.parse(raw);
    if (Array.isArray(legacy) && legacy.length > 0) {
      writeOfflineActions(account, [...readOfflineActions(account), ...(legacy as OfflineAction[])]);
    }
  } catch {
    // Unreadable leftovers or unavailable storage: nothing to adopt.
  }
}

/**
 * A session can also end without signing out here (it expired, or the password was changed on another
 * device), leaving that account's plan on this device. Once someone else signs in, it goes; only
 * records that never reached the server stay, for their own account to send later.
 */
function clearOtherAccountsOfflineData(account: number): void {
  try {
    for (const key of storageKeys()) {
      const owner = /^posture-training\.u(\d+)\./.exec(key)?.[1];
      if (owner === undefined || Number(owner) === account) continue;
      if (key === actionsKey(Number(owner))) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable; there is nothing to clear then.
  }
}

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}
