#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/liang/Desktop/锻体修容逆天/.worktrees/feature-mvp"
NODE_BIN="/Users/liang/.openclaw/tools/node-v22.22.0/bin"
STATE_DIR="/tmp/posture-training-control"
LOG_DIR="$STATE_DIR/logs"
CLOUDFLARED_DIR="/tmp/codex-cloudflared"
CLOUDFLARED_BIN="$CLOUDFLARED_DIR/cloudflared"
SERVER_SCREEN="posture_server"
TUNNEL_SCREEN="posture_tunnel"
SERVER_LOG="$LOG_DIR/server-public.log"
TUNNEL_LOG="$LOG_DIR/cloudflared-public.log"

mkdir -p "$LOG_DIR" "$CLOUDFLARED_DIR"

screen_exists() {
  local screens_file="$STATE_DIR/screens.txt"
  screen -ls >"$screens_file" 2>/dev/null || true
  grep -q "[.]$1[[:space:]]" "$screens_file"
}

health_ok() {
  curl -fsS --max-time 3 http://localhost:8787/api/health >/dev/null 2>&1
}

cloudflare_url() {
  grep -Eo 'https://[-a-zA-Z0-9.]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -n 1 || true
}

ensure_cloudflared() {
  if [[ -x "$CLOUDFLARED_BIN" ]]; then
    return
  fi

  local arch
  local url
  arch="$(uname -m)"
  case "$arch" in
    arm64)
      url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
      ;;
    x86_64)
      url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
      ;;
    *)
      echo "不支持的 Mac 架构：$arch"
      exit 1
      ;;
  esac

  echo "首次使用，正在下载 Cloudflare Tunnel 工具..."
  curl -L --fail --progress-bar -o "$CLOUDFLARED_DIR/cloudflared.tgz" "$url"
  tar -xzf "$CLOUDFLARED_DIR/cloudflared.tgz" -C "$CLOUDFLARED_DIR"
  chmod +x "$CLOUDFLARED_BIN"
}

start_server() {
  if health_ok; then
    echo "后端 server：运行中 http://localhost:8787"
    return
  fi

  screen -S "$SERVER_SCREEN" -X quit >/dev/null 2>&1 || true
  : >"$SERVER_LOG"
  screen -dmS "$SERVER_SCREEN" /bin/bash -lc "cd \"$PROJECT_DIR\" && PATH=\"$NODE_BIN:\$PATH\" npm run dev:server >> \"$SERVER_LOG\" 2>&1"

  for _ in {1..20}; do
    if health_ok; then
      echo "后端 server：已启动 http://localhost:8787"
      return
    fi
    sleep 1
  done

  echo "后端 server 启动失败，请看日志：$SERVER_LOG"
  tail -40 "$SERVER_LOG" || true
  exit 1
}

start_tunnel() {
  ensure_cloudflared

  local existing_url
  existing_url="$(cloudflare_url)"
  if screen_exists "$TUNNEL_SCREEN" && [[ -n "$existing_url" ]]; then
    echo "公网 Tunnel：已运行"
    echo
    echo "APK 的 Mac server 地址填："
    echo "$existing_url"
    return
  fi

  screen -S "$TUNNEL_SCREEN" -X quit >/dev/null 2>&1 || true
  pkill -f 'cloudflared tunnel --url http://localhost:8787' >/dev/null 2>&1 || true
  : >"$TUNNEL_LOG"
  screen -dmS "$TUNNEL_SCREEN" /bin/bash -lc "\"$CLOUDFLARED_BIN\" tunnel --url http://localhost:8787 --no-autoupdate --loglevel info >> \"$TUNNEL_LOG\" 2>&1"

  for _ in {1..45}; do
    existing_url="$(cloudflare_url)"
    if [[ -n "$existing_url" ]]; then
      echo "公网 Tunnel：已启动"
      echo
      echo "APK 的 Mac server 地址填："
      echo "$existing_url"
      echo
      return
    fi
    sleep 1
  done

  echo "公网 Tunnel 启动失败，请看日志：$TUNNEL_LOG"
  tail -80 "$TUNNEL_LOG" || true
  exit 1
}

start_all() {
  start_server
  start_tunnel
}

stop_all() {
  screen -S "$TUNNEL_SCREEN" -X quit >/dev/null 2>&1 || true
  screen -S "$SERVER_SCREEN" -X quit >/dev/null 2>&1 || true
  pkill -f 'cloudflared tunnel --url http://localhost:8787' >/dev/null 2>&1 || true
  pkill -f 'tsx src/server/index.ts' >/dev/null 2>&1 || true
  pkill -f 'npm run dev:server' >/dev/null 2>&1 || true
  echo "公网 Tunnel 和后端 server 已关闭。"
}

status() {
  if health_ok; then
    echo "后端 server：运行中 http://localhost:8787"
  else
    echo "后端 server：未运行"
  fi

  local url
  url="$(cloudflare_url)"
  if screen_exists "$TUNNEL_SCREEN" && [[ -n "$url" ]]; then
    echo "公网 Tunnel：运行中"
    echo "APK 的 Mac server 地址填："
    echo "$url"
  else
    echo "公网 Tunnel：未运行"
  fi

  echo
  echo "日志目录：$LOG_DIR"
}

case "${1:-start}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  status)
    status
    ;;
  *)
    echo "用法：$0 start|stop|status"
    exit 1
    ;;
esac
