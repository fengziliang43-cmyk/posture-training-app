import { Capacitor } from "@capacitor/core";
import type { PlanExplanation } from "../core/plan-explanation";
import type {
  DailyStatus,
  ExerciseCompletionStatus,
  ExerciseResult,
  GeneratedPlan,
  PlanDecision,
  TrainingProfile
} from "../core/types";
import type { WeeklyReview } from "../core/weekly-review";
import {
  cacheTodayPlan,
  clearCachedTodayPlan,
  flushOfflineActions,
  getCachedTodayPlan,
  queueOfflineAction
} from "./offline";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "user";
  onboardingCompleted: boolean;
}

export interface RegistrationInput {
  username: string;
  password: string;
  adultConfirmed: boolean;
  termsAccepted: boolean;
  captchaId?: string;
  captchaAnswer?: string;
}

export interface AuthCaptchaInput {
  captchaId: string;
  captchaAnswer: string;
}

export interface TrainingProfileInput
  extends Omit<TrainingProfile, "onboardingVersion" | "completedAt"> {
  adultConfirmed: boolean;
  healthConsent: boolean;
}

export interface ProfileResponse {
  profile: TrainingProfile | null;
}

export interface DailyCheckinInput extends Omit<DailyStatus, "redFlags"> {
  redFlags?: NonNullable<DailyStatus["redFlags"]>;
}

export interface AuthResponse {
  user: AuthUser;
  sessionToken?: string;
}

export interface AuthCapabilitiesResponse {
  registrationEnabled: boolean;
  captchaEnabled: boolean;
}

export interface AuthCaptchaResponse {
  captcha: {
    id: string;
    imageDataUrl: string;
    expiresAt: string;
  };
}

export interface CheckinResponse {
  checkin: DailyStatus & { id: number; createdAt: string };
}

/** What the server recorded when today's workout was saved. */
export interface PlanWorkout {
  completedAt: string;
  completionStatus: ExerciseCompletionStatus;
  lowBackPainAfter?: number | null;
  exerciseResults?: ExerciseResult[];
}

export interface PlanResponsePlan extends GeneratedPlan {
  id: number;
  createdAt: string;
  explanation?: PlanExplanation;
  /** Set once today's workout has been saved; null or missing before that. */
  workout?: PlanWorkout | null;
}

export interface PlanResponse {
  plan: PlanResponsePlan;
}

export interface WorkoutResponse {
  queued?: boolean;
  workoutLog: {
    id: number;
    planId: number;
    completedAt: string;
    completionStatus: string;
    notes?: string | null;
    lowBackPainAfter?: number | null;
    exerciseResults?: ExerciseResult[];
  };
}

export interface RecentCheckinsResponse {
  checkins: Array<DailyCheckinInput & { id: number; createdAt: string }>;
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
  deepseekAvailable?: boolean;
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

export interface AiTextResponse {
  explanation?: string;
  summary?: string;
  source: "local" | "deepseek";
  fallbackReason?: "disabled" | "not_configured" | "request_failed" | "safety_blocked";
  generatedAt?: string;
}

export interface DeepSeekTestResponse {
  ok: boolean;
  checkedAt?: string;
  error?: string;
}

export interface AdminStatsResponse {
  generatedAt: string;
  users: {
    total: number;
    new7d: number;
    new30d: number;
    onboarded: number;
    active7d: number;
    active30d: number;
  };
  activity: {
    checkins7d: number;
    completedWorkouts7d: number;
    completedWorkoutsTotal: number;
  };
  traffic: {
    available: boolean;
    provider: "goaccess";
    dashboardUrl: string | null;
  };
}

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable: boolean }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

const AUTH_TOKEN_KEY = "posture-training.auth-token";
export const DEFAULT_NATIVE_API_BASE_URL = "https://body.liang111.top";
const API_TIMEOUT_MS = 8000;
const AI_API_TIMEOUT_MS = 25000;

type ApiRequestInit = RequestInit & { timeoutMs?: number };

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(null, isNativeClient());
}

export function resolveApiBaseUrl(_storedValue: string | null, nativeClient: boolean): string {
  return nativeClient ? DEFAULT_NATIVE_API_BASE_URL : "";
}

export async function getMe(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/me");
}

export async function getAuthCapabilities(): Promise<AuthCapabilitiesResponse> {
  return apiRequest<AuthCapabilitiesResponse>("/api/auth/capabilities");
}

export async function getAuthCaptcha(): Promise<AuthCaptchaResponse> {
  return apiRequest<AuthCaptchaResponse>("/api/auth/captcha", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  return apiRequest<AdminStatsResponse>("/api/admin/stats");
}

export async function login(
  username: string,
  password: string,
  captcha?: AuthCaptchaInput
): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, ...captcha })
  });
  storeAuthToken(response.sessionToken);
  return response;
}

export async function register(input: RegistrationInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
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
    await apiRequest("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } finally {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    clearCachedTodayPlan();
  }
}

export async function deleteAccount(password: string, confirmation: string): Promise<void> {
  await apiRequest("/api/account", {
    method: "DELETE",
    body: JSON.stringify({ password, confirmation })
  });
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest<{ ok: true; reauthenticationRequired: true }>("/api/account/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword })
  });
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function getProfile(): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>("/api/profile");
}

export async function saveProfile(profile: TrainingProfileInput): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
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
  const normalized = normalizePlanResponse(response);
  cacheTodayPlan(normalized);
  return normalized;
}

export async function getTodayPlan(date?: string): Promise<PlanResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  try {
    const response = normalizePlanResponse(
      await apiRequest<PlanResponse>(`/api/plans/today${query}`)
    );
    cacheTodayPlan(response);
    return response;
  } catch (error) {
    if (isRetryableApiError(error)) {
      const cached = getCachedTodayPlan(date);
      if (cached) return normalizePlanResponse(cached);
    }
    throw error;
  }
}

function normalizePlanResponse(response: PlanResponse): PlanResponse {
  const raw = response.plan as unknown as Partial<PlanResponsePlan> & {
    reason?: string;
    type?: PlanResponsePlan["type"];
  };
  const type = raw.type ?? "recovery";
  const reason = raw.reason ?? "历史计划";
  const decision: PlanDecision = raw.decision ?? {
    readinessScore: 50,
    volumeMultiplier: 1,
    focusLabel: type === "recovery" ? "历史恢复计划" : "历史训练计划",
    reasons: [reason],
    avoidedReasons: [],
    cycleWeek: 1
  };

  return {
    plan: {
      ...response.plan,
      algorithmVersion: raw.algorithmVersion ?? "legacy-v1",
      estimatedMinutes: raw.estimatedMinutes ?? 0,
      decision
    }
  };
}

export async function replacePlanExercise(planId: number, exerciseId: string): Promise<PlanResponse> {
  const response = await apiRequest<PlanResponse>(`/api/plans/${planId}/exercises/${encodeURIComponent(exerciseId)}/replace`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return normalizePlanResponse(response);
}

export async function revertPlanExercise(planId: number, exerciseId: string): Promise<PlanResponse> {
  const response = await apiRequest<PlanResponse>(`/api/plans/${planId}/exercises/${encodeURIComponent(exerciseId)}/revert`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return normalizePlanResponse(response);
}

export async function completeWorkout(
  planId: number,
  payload: {
    completionStatus?: string;
    notes?: string;
    lowBackPainAfter?: number;
    exerciseResults?: ExerciseResult[];
  } = {},
  options: { queueOnFailure?: boolean } = {}
): Promise<WorkoutResponse> {
  const normalizedPayload = {
    planId,
    completionStatus: payload.completionStatus ?? "completed",
    notes: payload.notes,
    lowBackPainAfter: payload.lowBackPainAfter,
    exerciseResults: payload.exerciseResults
  };

  try {
    return await apiRequest<WorkoutResponse>(`/api/workouts/${planId}/complete`, {
      method: "POST",
      body: JSON.stringify(normalizedPayload)
    });
  } catch (error) {
    if (options.queueOnFailure === false || !isRetryableApiError(error)) {
      throw error;
    }

    queueOfflineAction({
      type: "completeWorkout",
      payload: normalizedPayload
    });

    return {
      queued: true,
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

export async function getRecentCheckins(): Promise<RecentCheckinsResponse> {
  return apiRequest<RecentCheckinsResponse>("/api/checkins/recent");
}

export async function listPhotos(): Promise<PhotosResponse> {
  return apiRequest<PhotosResponse>("/api/photos");
}

export async function uploadPhoto(formData: FormData): Promise<{ photo: PhotoRecord }> {
  return apiRequest<{ photo: PhotoRecord }>("/api/photos", {
    method: "POST",
    body: formData,
    timeoutMs: 30000
  });
}

export async function updatePhotoNote(photoId: number, note: string): Promise<{ photo: PhotoRecord }> {
  return apiRequest<{ photo: PhotoRecord }>(`/api/photos/${photoId}/note`, {
    method: "PUT",
    body: JSON.stringify({ note })
  });
}

export async function deletePhoto(photoId: number): Promise<void> {
  await apiRequest<{ ok: true }>(`/api/photos/${photoId}`, {
    method: "DELETE"
  });
}

export async function downloadPhotoFile(photoId: number): Promise<Blob> {
  const url = apiUrl(`/api/photos/${photoId}/file`);
  let response: Response;

  try {
    response = await fetchWithTimeout(url, {
      method: "GET",
      credentials: "include",
      headers: authHeaders()
    }, 30000);
  } catch (error) {
    throw new ApiRequestError(`网络请求失败：${describeApiError(error)}；请求地址：${url}`, {
      retryable: true
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiRequestError(
      `API ${response.status}${detail ? `：${detail}` : ""}；请求地址：${url}`,
      { status: response.status, retryable: response.status >= 500 }
    );
  }

  return response.blob();
}

export function describeApiError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function describeLoginError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 422) {
      return "验证码不正确或已过期，请重新输入。";
    }
    if (error.status === 400 || error.status === 401) {
      return "账号或密码不正确，请重新检查后再试。";
    }
    if (error.status === 429) {
      return "尝试次数过多，请稍后再登录。";
    }
    if (error.retryable) {
      return "登录服务暂时不可用，请检查网络后再试。";
    }
  }

  return "登录服务暂时不可用，请稍后再试。";
}

export function describeRegistrationError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 422) {
      return "验证码不正确或已过期，请重新输入。";
    }
    if (error.status === 409) {
      return "账号重复了，请直接登录或换一个账号/邮箱。";
    }
    if (error.status === 400) {
      return "注册信息不符合要求，请检查账号、至少 6 位密码和确认选项。";
    }
    if (error.status === 429) {
      return "注册尝试过于频繁，请稍后再试。";
    }
    if (error.retryable) {
      return "注册服务暂时不可用，请检查网络后再试。";
    }
  }

  return "注册服务暂时不可用，请稍后再试。";
}

export function describePasswordChangeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) {
      return "当前密码不正确，请重新输入。";
    }
    if (error.status === 400) {
      return "新密码至少 6 位，并且不能与当前密码相同。";
    }
    if (error.status === 429) {
      return "尝试次数过多，请稍后再修改密码。";
    }
    if (error.retryable) {
      return "密码修改服务暂时不可用，请检查网络后再试。";
    }
  }

  return "密码修改服务暂时不可用，请稍后再试。";
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
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError(`网络请求失败：${describeApiError(error)}；请求地址：${url}`, {
      retryable: true
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiRequestError(
      `API ${response.status}${detail ? `：${detail}` : ""}；请求地址：${url}`,
      {
        status: response.status,
        retryable: response.status === 408 || response.status === 429 || response.status >= 500
      }
    );
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
  const headers: Record<string, string> = {};
  if (isNativeClient()) headers["X-Zixu-Client"] = "native";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function storeAuthToken(token?: string): void {
  if (isNativeClient() && token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function isNativeClient(): boolean {
  return Capacitor.isNativePlatform();
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
  }, 60000);
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiRequestError(
      `API ${response.status}${detail ? `：${detail}` : ""}；请求地址：${url}`,
      { status: response.status, retryable: response.status >= 500 }
    );
  }
  return response.blob();
}

export function isRetryableApiError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.retryable;
}
