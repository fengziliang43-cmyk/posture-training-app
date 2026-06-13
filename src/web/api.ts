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

export interface ServerConnectionTestResult {
  ok: boolean;
  url: string;
  status?: number;
  statusText?: string;
  error?: string;
}

const API_BASE_URL_KEY = "posture-training.api-base-url";
const AUTH_TOKEN_KEY = "posture-training.auth-token";
const API_TIMEOUT_MS = 8000;
const CONNECTION_TEST_TIMEOUT_MS = 5000;

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

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = hasFormDataBody
    ? { ...authHeaders(), ...init.headers }
    : {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...init.headers
      };
  const url = apiUrl(path);
  let response: Response;

  try {
    response = await fetchWithTimeout(url, {
      credentials: "include",
      ...init,
      headers
    });
  } catch (error) {
    throw new Error(`网络请求失败：${describeApiError(error)}；请求地址：${url}`);
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}；请求地址：${url}`);
  }

  return response.json() as Promise<T>;
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
