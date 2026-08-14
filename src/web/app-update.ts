import { Capacitor } from "@capacitor/core";
import {
  CURRENT_APP_VERSION,
  type AppPlatform,
  type LatestReleaseManifest,
  type PlatformRelease
} from "../release";
import { DEFAULT_NATIVE_API_BASE_URL } from "./api";

const RELEASE_ENDPOINT = "/api/releases/latest";
const UPDATE_TIMEOUT_MS = 8000;

export interface AppUpdateResult {
  platform: AppPlatform;
  currentVersion: string;
  latest: PlatformRelease;
  updateAvailable: boolean;
  installAvailable: boolean;
}

export function getAppPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : "web";
}

export function resolveReleaseEndpoint(nativeClient = Capacitor.isNativePlatform()): string {
  return nativeClient ? `${DEFAULT_NATIVE_API_BASE_URL}${RELEASE_ENDPOINT}` : RELEASE_ENDPOINT;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }

  return 0;
}

export async function checkForAppUpdate(options: {
  platform?: AppPlatform;
  currentVersion?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<AppUpdateResult> {
  const platform = options.platform ?? getAppPlatform();
  const currentVersion = options.currentVersion ?? CURRENT_APP_VERSION;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(options.endpoint ?? resolveReleaseEndpoint(), {
      cache: "no-store",
      credentials: "omit",
      headers: Capacitor.isNativePlatform() ? { "X-Zixu-Client": "native" } : undefined,
      signal: controller.signal
    });
    if (!response.ok) throw new Error("release manifest unavailable");

    const manifest = (await response.json()) as unknown;
    if (!isLatestReleaseManifest(manifest)) throw new Error("invalid release manifest");
    const latest = manifest.platforms[platform];
    const updateAvailable = compareVersions(currentVersion, latest.version) < 0;

    return {
      platform,
      currentVersion,
      latest,
      updateAvailable,
      installAvailable: Boolean(latest.installUrl && isTrustedInstallUrl(platform, latest.installUrl))
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isTrustedInstallUrl(platform: AppPlatform, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (platform === "android") {
      return url.origin === DEFAULT_NATIVE_API_BASE_URL && url.pathname.endsWith(".apk");
    }
    if (platform === "ios") {
      return url.hostname === "apps.apple.com" || url.hostname === "testflight.apple.com";
    }
    return false;
  } catch {
    return false;
  }
}

export async function refreshWebApp(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
  window.location.reload();
}

function versionParts(value: string): number[] {
  return value
    .trim()
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) && part >= 0 ? part : 0));
}

function isLatestReleaseManifest(value: unknown): value is LatestReleaseManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<LatestReleaseManifest>;
  if (manifest.schemaVersion !== 1 || !manifest.platforms) return false;

  return (["android", "ios", "web"] as const).every((platform) => {
    const release = manifest.platforms?.[platform] as Partial<PlatformRelease> | undefined;
    return Boolean(
      release &&
      typeof release.version === "string" &&
      Number.isInteger(release.build) &&
      typeof release.publishedAt === "string" &&
      Array.isArray(release.releaseNotes) &&
      release.releaseNotes.every((note) => typeof note === "string") &&
      (release.installUrl === null || typeof release.installUrl === "string")
    );
  });
}
