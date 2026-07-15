#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APK_SOURCE="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
DESKTOP_DIR="$HOME/Desktop/锻体修容APK"
APK_DEST="$DESKTOP_DIR/锻体修容-新版-debug.apk"

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "没有找到 APK：$APK_SOURCE"
  echo "请先完成 Android debug 构建。"
  exit 1
fi

mkdir -p "$DESKTOP_DIR"
cp "$APK_SOURCE" "$APK_DEST"

echo "APK 已复制到：$APK_DEST"

if command -v open >/dev/null 2>&1; then
  open -R "$APK_DEST"
fi
