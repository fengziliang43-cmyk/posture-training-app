#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo "锻体修容控制台"
echo "================"
echo

while true; do
  "$SCRIPT_DIR/control.sh" status
  echo
  echo "请选择："
  echo "1. 开启服务"
  echo "2. 关闭服务"
  echo "3. 刷新状态"
  echo "4. 退出"
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
      "$SCRIPT_DIR/control.sh" start
      echo
      echo "如果上面显示“运行中”，服务就是开着的。现在去手机里点“测试连接”。"
      ;;
    2)
      "$SCRIPT_DIR/control.sh" stop
      ;;
    3)
      ;;
    4)
      echo "已退出控制台。"
      exit 0
      ;;
    *)
      echo "没看懂这个选项，输入 1、2、3 或 4 后按回车。"
      ;;
  esac

  echo
  read -r -p "按回车继续..." _
  clear
done
