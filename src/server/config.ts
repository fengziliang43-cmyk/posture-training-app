export interface ServerConfig {
  port: number;
  host: string;
  databaseFile: string;
  uploadDir: string;
  cookieSecret: string;
  allowedOrigins: string[];
  photoMaxBytes: number;
  secureCookies: boolean;
  sessionTtlHours: number;
  isProduction: boolean;
  deepseekUserKeysEnabled: boolean;
  registrationEnabled: boolean;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    databaseFile: process.env.DATABASE_FILE ?? "data/app.sqlite",
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    cookieSecret: process.env.COOKIE_SECRET ?? "local-dev-change-me",
    allowedOrigins: parseAllowedOrigins(process.env.CORS_ORIGINS),
    photoMaxBytes: parsePositiveNumber(process.env.PHOTO_MAX_BYTES, 10 * 1024 * 1024),
    secureCookies: parseBoolean(process.env.SECURE_COOKIES, process.env.NODE_ENV === "production"),
    sessionTtlHours: parsePositiveNumber(process.env.SESSION_TTL_HOURS, 24 * 30),
    isProduction: process.env.NODE_ENV === "production",
    deepseekUserKeysEnabled: parseBoolean(
      process.env.DEEPSEEK_USER_KEYS_ENABLED,
      process.env.NODE_ENV !== "production"
    ),
    registrationEnabled: parseBoolean(
      process.env.REGISTRATION_ENABLED,
      process.env.NODE_ENV !== "production"
    )
  };
}

export function assertServerConfig(config: ServerConfig): void {
  if (!config.isProduction) return;

  if (config.cookieSecret === "local-dev-change-me" || config.cookieSecret.length < 32) {
    throw new Error("Production requires COOKIE_SECRET with at least 32 characters.");
  }
  if (!config.secureCookies) {
    throw new Error("Production requires SECURE_COOKIES=true.");
  }
  if (config.deepseekUserKeysEnabled) {
    throw new Error("Production cannot store user-supplied DeepSeek keys without a secrets vault.");
  }
  if (config.databaseFile === ":memory:") {
    throw new Error("Production cannot use an in-memory database.");
  }
  if (!["127.0.0.1", "::1", "localhost"].includes(config.host)) {
    throw new Error("Production API must bind to loopback and be exposed through the HTTPS reverse proxy.");
  }
  const publicOrigins = config.allowedOrigins.filter((origin) => origin.startsWith("https://"));
  if (publicOrigins.length === 0) {
    throw new Error("Production requires at least one HTTPS CORS_ORIGINS entry.");
  }
  const insecurePublicOrigin = config.allowedOrigins.find(
    (origin) => origin.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
  if (insecurePublicOrigin) {
    throw new Error(`Production CORS origin must use HTTPS: ${insecurePublicOrigin}`);
  }
}

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost,capacitor://localhost")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}
