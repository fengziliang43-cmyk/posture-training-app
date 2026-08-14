# Android APK Setup

This project can be packaged as a local Android debug APK through Capacitor.

## Current APK

The debug APK generated during setup is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This is a debug build for local device testing. It is not a Play Store release package.
The latest renamed `姿序` build is:

```text
$HOME/Desktop/锻体修容APK/姿序-新版-debug.apk
```

## Build Environment

Default Android SDK path on macOS:

```text
$HOME/Library/Android/sdk
```

Installed SDK packages:

- `platform-tools`
- `platforms;android-36`
- `build-tools;36.0.0`

Java 21 is required by the generated Android/Capacitor build. The 2026-06-28 offline rebuild used a temporary JDK from:

```text
/tmp/codex-jdk21
```

That folder is under `/tmp`, so it may disappear. If it is gone, download or provide another JDK 21 and set `JDK_HOME` to that JDK root before running Gradle.

## Rebuild APK

From the project root:

```bash
npm run build
npx cap copy android
```

Then build the Android debug APK:

```bash
cd android
SDK_ROOT="$HOME/Library/Android/sdk"
JDK_HOME="${JDK_HOME:-/tmp/codex-jdk21/Contents/Home}"
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

Copy a Finder-visible APK to the Desktop:

```bash
npm run apk:desktop
```

Delivery folder:

```text
$HOME/Desktop/锻体修容APK
```

From the next verified APK build onward, this folder should contain only the latest APK. Verify the new APK first, then obtain confirmation before moving older APK files to Trash; do not permanently delete them without confirmation. TestFlight builds do not belong in this folder because iOS beta distribution is handled by App Store Connect.

Stop Gradle after a build if the Mac is warm:

```bash
cd android
SDK_ROOT="$HOME/Library/Android/sdk"
JDK_HOME="${JDK_HOME:-/tmp/codex-jdk21/Contents/Home}"
JAVA_HOME="$JDK_HOME" \
ANDROID_HOME="$SDK_ROOT" \
ANDROID_SDK_ROOT="$SDK_ROOT" \
PATH="$JDK_HOME/bin:$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH" \
./gradlew --stop
```

## Install On OPPO

1. Send `$HOME/Desktop/锻体修容APK/姿序-新版-debug.apk` to the test phone.
2. Open the APK on the phone.
3. If OPPO blocks it, enable installing from this source for the app you used to open the APK.
4. Install and open `姿序`.
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

8. Tap `测试连接`, then log in or use open registration. A new account must finish the three-step profile before generating its first plan.

The public registration build defaults to `https://body.liang111.top`, so a fresh install should show `登录 / 注册` without manual server setup. The server field remains available only for local development or recovery testing.

The phone and Mac should be on the same Tailscale network when accessing the Mac server remotely. If Tailscale is not convenient for a temporary test, use `tools/mac-control/一键开启公网连接.command`, choose `1`, and put the Cloudflare URL shown in the terminal into `Mac server 地址`; choose `2` after testing to close server and tunnel.

Command-line fallback:

```bash
npm run dev:server
npm run dev:web
```

## Important Notes

- This debug APK is for local testing.
- The Mac server is still required for login, sync, photo upload, and records.
- Offline viewing depends on the PWA cache and the latest synced plan.
- A production/release APK needs a release signing key and a separate release build process.
- Every public update must increment the Android version code and remain signed with the same production certificate, otherwise it cannot update the installed app in place.
- Do not commit private photos, SQLite data, debug keystores, or secrets.

## Website Update Flow (Planned)

After the fixed HTTPS website and production signing are ready:

1. Publish a small signed-release manifest containing `versionCode`, `versionName`, release notes, minimum supported version, APK URL, file size, and SHA-256.
2. Let the App check the manifest at cold start and at most once per day, then compare it with the installed version.
3. Show an optional update prompt by default. Reserve a blocking update only for confirmed security issues or an incompatible API version.
4. Open the official HTTPS download page when the user chooses to update.
5. The user downloads the release APK and confirms installation in Android. The App must not attempt a silent install.

Direct website installation requires the user to allow installation from that browser or file manager. The website must explain this clearly and publish the APK checksum and release notes.
