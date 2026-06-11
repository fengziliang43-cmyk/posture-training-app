export interface ServerConfig {
  port: number;
  host: string;
  databaseFile: string;
  uploadDir: string;
  cookieSecret: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    databaseFile: process.env.DATABASE_FILE ?? "data/app.sqlite",
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    cookieSecret: process.env.COOKIE_SECRET ?? "local-dev-change-me"
  };
}
