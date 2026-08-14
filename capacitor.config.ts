import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "local.posture.training",
  appName: "姿序",
  webDir: "dist/web",
  server: {
    androidScheme: "http"
  }
};

export default config;
