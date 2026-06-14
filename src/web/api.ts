import type { PlanExplanation } from "../core/plan-explanation";
import type { DailyStatus, GeneratedPlan } from "../core/types";
import type { WeeklyReview } from "../core/weekly-review";
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
  explanation?: PlanExplanation;
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
    calendarCheckins: Array<DailyCheckinInput & { id: number; createdAt: string }>;
    weeklyReview: WeeklyReview;
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
  note?: string | null;
  createdAt: string;
}

export interface PhotosResponse {
  photos: PhotoRecord[];
}

export interface SettingsRecord {
  notificationsEnabled: boolean;
  deepseekEnabled: boolean;
  deepseekApiKeyConfigured: boolean;
  deepseekModel: string;
  deepseekLastTestAt?: string;
  deepseekLastTestOk?: boolean;
  [key: string]: unknown;
}

export interface SettingsResponse {
  settings: SettingsRecord;
}

export interface ServerConnectionTestResult {
  ok: boolean;
  url: string;
  status?: number;
  statusText?: string;
  error?: string;
}

export interface AiTextResponse {
  explanation?: string;
  summary?: string;
  source: "local" | "deepseek";
}

export interface DeepSeekTestResponse {
  ok: boolean;
  checkedAt?: string;
  error?: string;
}

const API_BASE_URL_KEY = "posture-training.api-base-url";
const AUTH_TOKEN_KEY = "posture-training.auth-token";
const API_TIMEOUT_MS = 8000;
const AI_API_TIMEOUT_MS = 25000;
const CONNECTION_TEST_TIMEOUT_MS = 5000;

type ApiRequestInit = RequestInit & { timeoutMs?: number };

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

export async function testServerConnection(value = getApiBaseUrl()): Promise<ServerConnectionTestResult> {
  const url = apiUrl("/api/health", value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: authHeaders(),
      credentials: "include",
      signal: controller.signal
    });

    return {
      ok: response.ok,
      url,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: describeApiError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
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

export async function replacePlanExercise(planId: number, exerciseId: string): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(`/api/plans/${planId}/exercises/${encodeURIComponent(exerciseId)}/replace`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function revertPlanExercise(planId: number, exerciseId: string): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(`/api/plans/${planId}/exercises/${encodeURIComponent(exerciseId)}/revert`, {
    method: "POST",
    body: JSON.stringify({})
  });
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
  const url = apiUrl("/api/photos");
  let response: Response;

  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: formData
    });
  } catch (error) {
    throw new Error(`网络请求失败：${describeApiError(error)}；请求地址：${url}`);
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}；请求地址：${url}`);
  }

  return response.json() as Promise<{ photo: PhotoRecord }>;
}

export async function updatePhotoNote(photoId: number, note: string): Promise<{ photo: PhotoRecord }> {
  return apiRequest<{ photo: PhotoRecord }>(`/api/photos/${photoId}/note`, {
    method: "PUT",
    body: JSON.stringify({ note })
  });
}

export function describeServerConnectionResult(result: ServerConnectionTestResult): string {
  if (result.ok) {
    return `Mac server 可以连接。测试地址：${result.url}`;
  }

  if (result.status) {
    return `Mac server 有响应但状态异常：HTTP ${result.status} ${result.statusText ?? ""}。测试地址：${result.url}`;
  }

  return `Mac server 连接失败：${result.error ?? "未知网络错误"}。测试地址：${result.url}`;
}

export function describeApiError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs, ...requestInit } = init;
  const hasFormDataBody = typeof FormData !== "undefined" && requestInit.body instanceof FormData;
  const headers = hasFormDataBody
    ? { ...authHeaders(), ...requestInit.headers }
    : {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...requestInit.headers
      };
  const url = apiUrl(path);
  let response: Response;

  try {
    response = await fetchWithTimeout(url, {
      credentials: "include",
      ...requestInit,
      headers
    }, timeoutMs);
  } catch (error) {
    throw new Error(`网络请求失败：${describeApiError(error)}；请求地址：${url}`);
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`API ${response.status}${detail ? `：${detail}` : ""}；请求地址：${url}`);
  }

  return response.json() as Promise<T>;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { error?: unknown; message?: unknown };
      const value = body.error ?? body.message;
      return typeof value === "string" ? value : "";
    }

    const text = await response.text();
    return text.slice(0, 160);
  } catch {
    return "";
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function apiUrl(path: string, baseUrl = getApiBaseUrl()): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return path;
  }

  return `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeApiBaseUrl(value: string): string {
  const normalized = toHalfWidth(value).replace(/\s+/g, "").replace(/\/+$/, "");

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (/^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(normalized)) {
    return `http://${normalized}`;
  }

  return normalized;
}

function toHalfWidth(value: string): string {
  return value
    .trim()
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
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

export async function saveDeepSeekApiKey(apiKey: string, model?: string): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings/deepseek-key", {
    method: "PUT",
    body: JSON.stringify({ apiKey, model })
  });
}

export async function clearDeepSeekApiKey(): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings/deepseek-key", {
    method: "DELETE"
  });
}

export async function testDeepSeekConnection(): Promise<DeepSeekTestResponse> {
  return apiRequest<DeepSeekTestResponse>("/api/ai/deepseek/test", {
    method: "POST",
    body: JSON.stringify({}),
    timeoutMs: AI_API_TIMEOUT_MS
  });
}

export async function generateDailyExplanation(planId: number): Promise<AiTextResponse> {
  return apiRequest<AiTextResponse>("/api/ai/daily-explanation", {
    method: "POST",
    body: JSON.stringify({ planId }),
    timeoutMs: AI_API_TIMEOUT_MS
  });
}

export async function generateWeeklyReview(date?: string): Promise<AiTextResponse> {
  return apiRequest<AiTextResponse>("/api/ai/weekly-review", {
    method: "POST",
    body: JSON.stringify({ date }),
    timeoutMs: AI_API_TIMEOUT_MS
  });
}

export async function downloadBackup(): Promise<Blob> {
  const url = apiUrl("/api/backup/export");
  const response = await fetchWithTimeout(url, {
    method: "GET",
    credentials: "include",
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}；请求地址：${url}`);
  }
  return response.blob();
}
