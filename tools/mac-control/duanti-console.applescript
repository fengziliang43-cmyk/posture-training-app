set controlScript to system attribute "ZIXU_CONTROL_SCRIPT"

if controlScript is "" then
  display dialog "请先把 ZIXU_CONTROL_SCRIPT 设置为 tools/mac-control/control.sh 的绝对路径。" buttons {"退出"} default button "退出" with title "姿序控制台"
  return
end if

repeat
  set currentStatus to do shell script quoted form of controlScript & " status"
  set action to button returned of (display dialog currentStatus buttons {"退出", "关闭服务", "开启服务"} default button "开启服务" with title "姿序控制台")

  if action is "退出" then
    exit repeat
  else if action is "开启服务" then
    set resultText to do shell script quoted form of controlScript & " start"
    display dialog resultText buttons {"知道了"} default button "知道了" with title "姿序控制台"
  else if action is "关闭服务" then
    set resultText to do shell script quoted form of controlScript & " stop"
    display dialog resultText buttons {"知道了"} default button "知道了" with title "姿序控制台"
  end if
end repeat
