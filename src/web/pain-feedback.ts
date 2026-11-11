/**
 * What the app really does with the "back pain after the workout" answer (see core/readiness.ts):
 * - 2 points higher than before: the next readiness score is lowered, so the next workout may be lighter;
 * - 3 or more points higher, or 2+ points higher in two of the last three workouts: the next one is a recovery day.
 */
export function describePainChange(before: number, after: number): string {
  const change = after - before;
  if (change >= 3) return `比练前高 ${change} 分，下一次会改成恢复日。`;
  if (change === 2) {
    return "比练前高 2 分，下一次的评分会下调，训练量可能降低；最近几次都这样的话，会改成恢复日。";
  }
  return "和练前相比没有明显加重。";
}
