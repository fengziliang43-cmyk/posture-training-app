#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/liang/Desktop/锻体修容逆天/.worktrees/feature-mvp"
NODE_BIN="/Users/liang/.openclaw/tools/node-v22.22.0/bin"
STATE_DIR="/tmp/posture-training-control"
LOG_DIR="$STATE_DIR/logs"
SERVER_PID="$STATE_DIR/server.pid"
WEB_PID="$STATE_DIR/web.pid"

mkdir -p "$LOG_DIR"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start_service() {
  local name="$1"
  local script="$2"
  local pid_file="$3"
  local log_file="$4"

  if is_running "$pid_file"; then
    echo "$name 已经在运行。"
    return
  fi

  (
    cd "$PROJECT_DIR"
    PATH="$NODE_BIN:$PATH" nohup npm run "$script" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  sleep 1
  if is_running "$pid_file"; then
    echo "$name 已启动。"
  else
    echo "$name 启动失败，请看日志：$log_file"
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    echo "$name 没有在运行。"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill "$pid" 2>/dev/null || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
  echo "$name 已关闭。"
}

status_line() {
  local name="$1"
  local pid_file="$2"
  local url="$3"

  if is_running "$pid_file"; then
    echo "${name}：运行中 $url"
  else
    echo "${name}：未运行"
  fi
}

access_urls() {
  local tailscale_ip
  tailscale_ip="$(command -v tailscale >/dev/null 2>&1 && tailscale ip -4 2>/dev/null | head -n 1 || true)"

  echo "本机后端：http://localhost:8787"
  echo "本机网页：http://localhost:5173"
  if [[ -n "$tailscale_ip" ]]; then
    echo "手机 APK 填：http://$tailscale_ip:8787"
    echo "手机浏览器可开：http://$tailscale_ip:5173"
  else
    echo "未检测到 tailscale 命令；手机地址可在 Tailscale 里查看这台 Mac 的 100.x IP。"
  fi
}

case "${1:-status}" in
  start)
    start_service "后端 server" "dev:server" "$SERVER_PID" "$LOG_DIR/server.log"
    start_service "网页 web" "dev:web" "$WEB_PID" "$LOG_DIR/web.log"
    echo
    "$0" status
    ;;
  stop)
    stop_service "后端 server" "$SERVER_PID"
    stop_service "网页 web" "$WEB_PID"
    ;;
  status)
    status_line "后端 server" "$SERVER_PID" "http://localhost:8787"
    status_line "网页 web" "$WEB_PID" "http://localhost:5173"
    echo
    access_urls
    echo
    echo "日志目录：$LOG_DIR"
    ;;
  *)
    echo "用法：$0 start|stop|status"
    exit 1
    ;;
esac
