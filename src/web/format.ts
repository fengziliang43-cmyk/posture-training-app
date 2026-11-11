const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** "2026-11-11" -> "11月11日 周三". A calendar date, so no time zone is involved. */
export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}月${day}日 周${WEEKDAYS[weekday]}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/** Energy 1-5 in words. */
export const ENERGY_LABELS = ["很差", "差", "一般", "好", "很好"] as const;

export function describeEnergy(score: number): string {
  return ENERGY_LABELS[Math.min(5, Math.max(1, Math.round(score))) - 1];
}

/**
 * A plan's reason reads "<why today is like this>。 动态安排“<title>”，预计 N 分钟。".
 * The second sentence repeats the title and the minutes shown next to it, so keep only the first.
 */
export function shortReason(reason: string): string {
  const head = reason.split(" 动态安排")[0].trim();
  return head || reason;
}
