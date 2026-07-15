#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo "锻体修容公网连接"
echo "================"
echo

while true; do
  "$SCRIPT_DIR/public-control.sh" status
  echo
  echo "请选择："
  echo "1. 开启公网连接"
  echo "2. 关闭公网连接"
  echo "3. 刷新状态"
  echo "4. 退出窗口"
  echo
  read -r -p "输入数字后按回车：" choice
  choice="${choice//[[:space:]]/}"
  choice="${choice//１/1}"
  choice="${choice//２/2}"
  choice="${choice//３/3}"
  choice="${choice//４/4}"
  echo

  case "$choice" in
    1)
      if ! "$SCRIPT_DIR/public-control.sh" start; then
        echo
        echo "启动没有完成。窗口会保留在这里，你可以选 3 刷新状态，或选 2 关闭后重试。"
      fi
      ;;
    2)
      if ! "$SCRIPT_DIR/public-control.sh" stop; then
        echo
        echo "关闭时遇到问题。窗口会保留在这里，你可以选 3 刷新状态。"
      fi
      ;;
    3)
      ;;
    4)
      echo "已退出窗口。"
      echo "如果上面显示仍在运行，说明服务还开着；要关闭请重新打开本窗口选 2。"
      exit 0
      ;;
    *)
      echo "没看懂这个选项，输入 1、2、3 或 4 后按回车。"
      ;;
  esac

  echo
  read -r -p "按回车继续..." _
  clear
  echo "锻体修容公网连接"
  echo "================"
  echo
done
