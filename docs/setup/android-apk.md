# Android APK Setup

This project can be packaged as a local Android debug APK through Capacitor.

## Current APK

The debug APK generated during setup is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This is a debug build for Liang's own phone testing. It is not a Play Store release package.

## Build Environment

Persistent Android SDK path on this Mac:

```text
/Users/liang/Library/Android/sdk
```

Installed SDK packages:

- `platform-tools`
- `platforms;android-36`
- `build-tools;36.0.0`

Java 21 is required by the generated Android/Capacitor build. During the first APK build, a temporary JDK was used from:

```text
/tmp/posture-training-jdk21/jdk/Contents/Home
```

If that temporary folder is gone later, install or provide another JDK 21 and set `JAVA_HOME` to it before running Gradle.

## Rebuild APK

From the project root:

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run build
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npx cap copy android
```

Then build the Android debug APK:

```bash
cd android
SDK_ROOT="$HOME/Library/Android/sdk"
JDK_HOME="/tmp/posture-training-jdk21/jdk/Contents/Home"
JAVA_HOME="$JDK_HOME" \
ANDROID_HOME="$SDK_ROOT" \
ANDROID_SDK_ROOT="$SDK_ROOT" \
PATH="$JDK_HOME/bin:$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH" \
./gradlew assembleDebug
```

Expected output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Stop Gradle after a build if the Mac is warm:

```bash
cd android
SDK_ROOT="$HOME/Library/Android/sdk"
JDK_HOME="/tmp/posture-training-jdk21/jdk/Contents/Home"
JAVA_HOME="$JDK_HOME" \
ANDROID_HOME="$SDK_ROOT" \
ANDROID_SDK_ROOT="$SDK_ROOT" \
PATH="$JDK_HOME/bin:$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH" \
./gradlew --stop
```

## Install On OPPO

1. Send `android/app/build/outputs/apk/debug/app-debug.apk` to the OPPO phone.
2. Open the APK on the phone.
3. If OPPO blocks it, enable installing from this source for the app you used to open the APK.
4. Install and open `锻体修容`.
5. On the Mac, open the service control panel:

```text
tools/mac-control/锻体修容控制台.command
```

6. Click `开启服务`.
7. On the OPPO login screen, fill `Mac server 地址` with the Mac server address:

```text
http://<Mac Tailscale IP>:8787
```

For example:

```text
http://100.x.x.x:8787
```

8. Tap `测试连接`, then log in or run first setup.

The phone and Mac should be on the same Tailscale network when accessing the Mac server remotely.

Command-line fallback:

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run dev:server
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run dev:web
```

## Important Notes

- This debug APK is for local testing.
- The Mac server is still required for login, sync, photo upload, and records.
- Offline viewing depends on the PWA cache and the latest synced plan.
- A production/release APK needs a release signing key and a separate release build process.
- Do not commit private photos, SQLite data, debug keystores, or secrets.
