import type { ExerciseCompletionStatus, ExerciseResult } from "./types";

/** How a workout went, judged from the result of every exercise. One rule for the server and the app. */
export function deriveCompletionStatus(results: ExerciseResult[]): ExerciseCompletionStatus {
  if (results.length > 0 && results.every((result) => result.completionStatus === "completed")) {
    return "completed";
  }
  if (results.length > 0 && results.every((result) => result.completionStatus === "skipped")) {
    return "skipped";
  }
  return "partial";
}
