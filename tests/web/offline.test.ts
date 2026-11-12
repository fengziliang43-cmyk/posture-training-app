import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTodayPlan, logout, type PlanResponse } from "../../src/web/api";
import {
  cacheTodayPlan,
  clearAccountOfflineData,
  exerciseFeedbackKey,
  flushOfflineActions,
  getCachedTodayPlan,
  queueOfflineAction,
  readOfflineActions,
  setOfflineAccount
} from "../../src/web/offline";

class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

function plan(id: number, date = "2026-11-12"): PlanResponse {
  return { plan: { id, date } } as unknown as PlanResponse;
}

function completion(planId: number) {
  return {
    type: "completeWorkout" as const,
    payload: { planId, completionStatus: "completed", lowBackPainAfter: 2 }
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  setOfflineAccount(null);
});

afterEach(() => {
  setOfflineAccount(null);
  vi.unstubAllGlobals();
});

describe("offline data on a shared device", () => {
  it("never shows one account's cached plan to the next account", () => {
    setOfflineAccount(1);
    cacheTodayPlan(plan(11));
    setOfflineAccount(2);
    expect(getCachedTodayPlan("2026-11-12")).toBeNull();
  });

  it("keeps the offline plan for the same account when nobody else signed in between", () => {
    setOfflineAccount(1);
    cacheTodayPlan(plan(11));
    setOfflineAccount(null);
    setOfflineAccount(1);
    expect(getCachedTodayPlan("2026-11-12")?.plan.id).toBe(11);
  });

  it("only sends the signed-in account's unsynced records", async () => {
    setOfflineAccount(1);
    queueOfflineAction(completion(11));
    setOfflineAccount(2);
    const completeWorkout = vi.fn(async () => undefined);
    expect(await flushOfflineActions({ completeWorkout })).toBe(0);
    expect(completeWorkout).not.toHaveBeenCalled();

    setOfflineAccount(1);
    expect(await flushOfflineActions({ completeWorkout })).toBe(1);
    expect(completeWorkout).toHaveBeenCalledWith(11, expect.objectContaining({ planId: 11 }));
    expect(readOfflineActions(1)).toEqual([]);
  });

  it("queues nothing while nobody is signed in", () => {
    expect(queueOfflineAction(completion(11))).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("clears the account's plan and exercise notes on sign-out but keeps its unsynced records", () => {
    setOfflineAccount(1);
    cacheTodayPlan(plan(11));
    queueOfflineAction(completion(11));
    localStorage.setItem(exerciseFeedbackKey(1, 11), "[]");
    cacheTodayPlan(plan(22), 2);

    clearAccountOfflineData(1, { keepUnsynced: true });
    expect(getCachedTodayPlan(undefined, 1)).toBeNull();
    expect(localStorage.getItem(exerciseFeedbackKey(1, 11))).toBeNull();
    expect(readOfflineActions(1)).toHaveLength(1);
    expect(getCachedTodayPlan(undefined, 2)?.plan.id).toBe(22);

    clearAccountOfflineData(1, { keepUnsynced: false });
    expect(readOfflineActions(1)).toEqual([]);
    expect(getCachedTodayPlan(undefined, 2)?.plan.id).toBe(22);
  });

  it("clears the previous account's plan and notes when someone else signs in, even without a sign-out here", () => {
    setOfflineAccount(1);
    cacheTodayPlan(plan(11));
    localStorage.setItem(exerciseFeedbackKey(1, 11), "[]");
    queueOfflineAction(completion(11));

    // Account 1's session ended elsewhere (it expired); account 2 signs in on this device.
    setOfflineAccount(2);
    expect(getCachedTodayPlan(undefined, 1)).toBeNull();
    expect(localStorage.getItem(exerciseFeedbackKey(1, 11))).toBeNull();
    expect(readOfflineActions(1)).toHaveLength(1);
  });

  it("drops a record the server will never accept and keeps one that may still go through", async () => {
    setOfflineAccount(1);
    queueOfflineAction(completion(11));
    queueOfflineAction(completion(12));
    const notThisAccountsPlan = new Error("plan not found");
    const completeWorkout = vi.fn(async (planId: number) => {
      throw planId === 11 ? notThisAccountsPlan : new Error("offline");
    });

    await flushOfflineActions({ completeWorkout, isPermanentFailure: (error) => error === notThisAccountsPlan });
    expect(readOfflineActions(1).map((action) => action.payload.planId)).toEqual([12]);
  });

  it("takes over what was saved before keys carried the account", () => {
    localStorage.setItem("posture-training.cached-today-plan", JSON.stringify(plan(9)));
    localStorage.setItem("posture-training.exercise-feedback.9", "[]");
    localStorage.setItem(
      "posture-training.offline-actions",
      JSON.stringify([{ id: "a", type: "completeWorkout", createdAt: "2026-11-11T00:00:00.000Z", payload: { planId: 9, completionStatus: "completed" } }])
    );
    localStorage.setItem("posture-training.auth-token", "kept");

    setOfflineAccount(5);
    expect(localStorage.getItem("posture-training.cached-today-plan")).toBeNull();
    expect(localStorage.getItem("posture-training.exercise-feedback.9")).toBeNull();
    expect(localStorage.getItem("posture-training.offline-actions")).toBeNull();
    expect(getCachedTodayPlan()).toBeNull();
    expect(readOfflineActions(5).map((action) => action.payload.planId)).toEqual([9]);
    expect(localStorage.getItem("posture-training.auth-token")).toBe("kept");
  });
});

describe("API calls that outlive the account that made them", () => {
  it("stores a late plan answer for nobody once its account has signed out", async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; })));
    setOfflineAccount(1);
    const pending = getTodayPlan("2026-11-12");

    // Account 1 signs out and account 2 signs in while the request is still on its way.
    setOfflineAccount(2);
    answer(json(plan(11)));
    await pending;

    expect(getCachedTodayPlan("2026-11-12")).toBeNull();
    expect(getCachedTodayPlan("2026-11-12", 1)).toBeNull();
  });

  it("keeps the plan for offline use while the same account stays signed in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(plan(11))));
    setOfflineAccount(1);
    await getTodayPlan("2026-11-12");
    expect(getCachedTodayPlan("2026-11-12")?.plan.id).toBe(11);
  });

  it("signing out removes the account's plan from this device and keeps a record the server could not take yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/api/workouts/") ? json({ error: "busy" }, 503) : json({ ok: true }))));
    setOfflineAccount(1);
    cacheTodayPlan(plan(11));
    queueOfflineAction(completion(11));

    await logout();

    expect(getCachedTodayPlan(undefined, 1)).toBeNull();
    expect(readOfflineActions(1)).toHaveLength(1);
  });
});
