import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "local.posture.training",
  appName: "锻体修容",
  webDir: "dist/web",
  server: {
    androidScheme: "http"
  }
};

export default config;
