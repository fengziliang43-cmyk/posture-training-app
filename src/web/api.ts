import type { DailyStatus, GeneratedPlan } from "../core/types";
import {
  cacheTodayPlan,
  flushOfflineActions,
  getCachedTodayPlan,
  queueOfflineAction
} from "./offline";

export interface AuthUser {
  id: number;
  username: string;
}

export interface DailyCheckinInput extends Omit<DailyStatus, "redFlags"> {
  redFlags?: NonNullable<DailyStatus["redFlags"]>;
}

export interface AuthResponse {
  user: AuthUser;
  sessionToken?: string;
}

export interface CheckinResponse {
  checkin: DailyStatus & { id: number; createdAt: string };
}

export interface PlanResponsePlan extends GeneratedPlan {
  id: number;
  createdAt: string;
}

export interface PlanResponse {
  plan: PlanResponsePlan;
}

export interface WorkoutResponse {
  workoutLog: {
    id: number;
    planId: number;
    completedAt: string;
    completionStatus: string;
    notes?: string | null;
    lowBackPainAfter?: number | null;
  };
}

export interface RecordsSummaryResponse {
  summary: {
    checkins: Array<DailyCheckinInput & { id: number; createdAt: string }>;
    weeklyTrainingCount: number;
    progressionRecords: Array<{
      id: number;
      date: string;
      templateId: string;
      reason: string;
    }>;
  };
}

export interface PhotoRecord {
  id: number;
  photoDate: string;
  angle: string;
  filePath: string;
  mimeType: string;
  createdAt: string;
}

export interface PhotosResponse {
  photos: PhotoRecord[];
}

export interface SettingsRecord {
  notificationsEnabled: boolean;
  deepseekEnabled: boolean;
  [key: string]: unknown;
}

export interface SettingsResponse {
  settings: SettingsRecord;
}

const API_BASE_URL_KEY = "posture-training.api-base-url";
const AUTH_TOKEN_KEY = "posture-training.auth-token";

export function getApiBaseUrl(): string {
  return localStorage.getItem(API_BASE_URL_KEY) ?? "";
}

export function setApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized) {
    localStorage.setItem(API_BASE_URL_KEY, normalized);
  } else {
    localStorage.removeItem(API_BASE_URL_KEY);
  }
  return normalized;
}

export async function testServerConnection(value = getApiBaseUrl()): Promise<boolean> {
  const response = await fetch(apiUrl("/api/health", value), {
    headers: authHeaders(),
    credentials: "include"
  });
  return response.ok;
}

export async function getMe(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/me");
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  storeAuthToken(response.sessionToken);
  return response;
}

export async function setup(username: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  storeAuthToken(response.sessionToken);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } finally {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function submitCheckin(checkin: DailyCheckinInput): Promise<CheckinResponse> {
  return apiRequest<CheckinResponse>("/api/checkins", {
    method: "POST",
    body: JSON.stringify(checkin)
  });
}

export async function createTodayPlan(date: string): Promise<PlanResponse> {
  const response = await apiRequest<PlanResponse>("/api/plans/today", {
    method: "POST",
    body: JSON.stringify({ date })
  });
  cacheTodayPlan(response);
  return response;
}

export async function getTodayPlan(date?: string): Promise<PlanResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  try {
    const response = await apiRequest<PlanResponse>(`/api/plans/today${query}`);
    cacheTodayPlan(response);
    return response;
  } catch (error) {
    const cached = getCachedTodayPlan(date);
    if (cached) return cached;
    throw error;
  }
}

export async function completeWorkout(
  planId: number,
  payload: { completionStatus?: string; notes?: string; lowBackPainAfter?: number } = {},
  options: { queueOnFailure?: boolean } = {}
): Promise<WorkoutResponse> {
  const normalizedPayload = {
    planId,
    completionStatus: payload.completionStatus ?? "completed",
    notes: payload.notes,
    lowBackPainAfter: payload.lowBackPainAfter
  };

  try {
    return await apiRequest<WorkoutResponse>(`/api/workouts/${planId}/complete`, {
      method: "POST",
      body: JSON.stringify(normalizedPayload)
    });
  } catch (error) {
    if (options.queueOnFailure === false) {
      throw error;
    }

    queueOfflineAction({
      type: "completeWorkout",
      payload: normalizedPayload
    });

    return {
      workoutLog: {
        id: -1,
        planId,
        completedAt: new Date().toISOString(),
        completionStatus: normalizedPayload.completionStatus,
        notes: normalizedPayload.notes,
        lowBackPainAfter: normalizedPayload.lowBackPainAfter
      }
    };
  }
}

export async function flushQueuedOfflineActions(): Promise<number> {
  return flushOfflineActions({
    completeWorkout: (planId, payload) =>
      completeWorkout(planId, payload, { queueOnFailure: false })
  });
}

export async function getRecordsSummary(date?: string): Promise<RecordsSummaryResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<RecordsSummaryResponse>(`/api/records/summary${query}`);
}

export async function listPhotos(): Promise<PhotosResponse> {
  return apiRequest<PhotosResponse>("/api/photos");
}

export async function uploadPhoto(formData: FormData): Promise<{ photo: PhotoRecord }> {
  const response = await fetch(apiUrl("/api/photos"), {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: formData
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json() as Promise<{ photo: PhotoRecord }>;
}

export async function getSettings(): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings");
}

export async function updateSettings(
  settings: Record<string, unknown>
): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = hasFormDataBody
    ? { ...authHeaders(), ...init.headers }
    : {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...init.headers
      };
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function apiUrl(path: string, baseUrl = getApiBaseUrl()): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return path;
  }

  return `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function storeAuthToken(token?: string): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}
