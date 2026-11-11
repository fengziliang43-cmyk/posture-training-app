/**
 * The server stamps rows with SQLite's CURRENT_TIMESTAMP: UTC, written as "2026-11-11 04:17:00" with no zone marker.
 * A browser would read that as local time, so add the zone before parsing.
 */
export function parseServerTimestamp(value: string): Date | null {
  // A bare date has no time of day to show.
  if (!/\d{2}:\d{2}/.test(value)) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Wall-clock time (HH:MM) in the viewer's own time zone. */
export function formatLocalClock(value: string): string {
  const date = parseServerTimestamp(value);
  if (!date) return value.slice(11, 16);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface DatedPhoto {
  id: number;
  photoDate: string;
  createdAt: string;
}

/** Older photo first, newer photo second. Photos from the same day are told apart by upload time, then id. */
export function orderOlderFirst<T extends DatedPhoto>(photos: T[]): T[] {
  return [...photos].sort(
    (a, b) =>
      a.photoDate.localeCompare(b.photoDate) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id - b.id
  );
}
