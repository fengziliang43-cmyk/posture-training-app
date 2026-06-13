import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "local.liang.posturetraining",
  appName: "锻体修容",
  webDir: "dist/web",
  server: {
    androidScheme: "http"
  }
};

export default config;
