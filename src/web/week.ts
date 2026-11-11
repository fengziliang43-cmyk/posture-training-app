import { MAX_MAIN_SESSIONS_PER_WEEK } from "../core/weekly-schedule";
import type { RecordsSummaryResponse } from "./api";

export interface WeekSummary {
  /** Monday of the week, "YYYY-MM-DD". */
  weekStart: string;
  /** Days of the week (and month) with a finished main workout. */
  trainedDates: string[];
  mainCount: number;
  limit: number;
}

export function buildWeekSummary(summary: RecordsSummaryResponse["summary"]): WeekSummary {
  return {
    weekStart: summary.weeklyReview.weekStart,
    trainedDates: summary.trainedDates ?? [],
    mainCount: summary.weeklyTrainingCount,
    limit: MAX_MAIN_SESSIONS_PER_WEEK
  };
}

const LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** Monday to Sunday of the week that starts on `weekStart`. */
export function weekDays(weekStart: string): Array<{ date: string; label: string }> {
  return LABELS.map((label, index) => ({ date: addDays(weekStart, index), label }));
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
