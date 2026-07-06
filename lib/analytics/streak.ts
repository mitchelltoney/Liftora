/**
 * Streak logic.
 *
 * Two counters, shown side by side and labelled clearly in the UI:
 *  - weekStreak: consecutive weeks hitting the user's weekly session target.
 *    The current week counts as soon as it hits target; an in-progress week
 *    that hasn't hit target yet does NOT break the chain (it just doesn't
 *    extend it).
 *  - dayChain: consecutive calendar days with ≥1 session, ending today or
 *    yesterday (an empty "today" doesn't break the chain until tomorrow).
 *
 * All boundaries are computed in the user's local time.
 */

export interface StreakResult {
  weekStreak: number;
  dayChain: number;
}

/** Local midnight for a timestamp. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local start of the week containing ts. */
function startOfWeek(ts: number, weekStartsOn: 0 | 1): number {
  const d = new Date(startOfDay(ts));
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function previousWeekStart(weekStart: number, weekStartsOn: 0 | 1): number {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return startOfWeek(d.getTime(), weekStartsOn);
}

/** DST-safe: midnight − 12h always lands inside the previous calendar day. */
function previousDayStart(dayStart: number): number {
  return startOfDay(dayStart - 12 * 3600 * 1000);
}

/**
 * Compute both streaks from session start timestamps.
 *
 * @param sessionStarts startedAt of every COMPLETED session (ms epoch)
 * @param now           current time (injectable for tests)
 */
export function computeStreaks(
  sessionStarts: ReadonlyArray<number>,
  weeklyTarget: number,
  weekStartsOn: 0 | 1,
  now: number,
): StreakResult {
  if (sessionStarts.length === 0 || weeklyTarget < 1) {
    return { weekStreak: 0, dayChain: 0 };
  }

  // ---- distinct training days & sessions-per-week ----
  const trainingDays = new Set<number>();
  const sessionsPerWeek = new Map<number, number>();
  for (const ts of sessionStarts) {
    trainingDays.add(startOfDay(ts));
    const week = startOfWeek(ts, weekStartsOn);
    sessionsPerWeek.set(week, (sessionsPerWeek.get(week) ?? 0) + 1);
  }

  // ---- weekly streak ----
  const currentWeek = startOfWeek(now, weekStartsOn);
  let weekStreak = 0;
  let cursor = currentWeek;
  if ((sessionsPerWeek.get(cursor) ?? 0) >= weeklyTarget) {
    weekStreak++;
  }
  // Whether or not the current week has hit target yet, continue counting
  // from last week — only a COMPLETED week that missed target breaks it.
  cursor = previousWeekStart(cursor, weekStartsOn);
  while ((sessionsPerWeek.get(cursor) ?? 0) >= weeklyTarget) {
    weekStreak++;
    cursor = previousWeekStart(cursor, weekStartsOn);
  }

  // ---- day chain ----
  const today = startOfDay(now);
  let dayChain = 0;
  let dayCursor = trainingDays.has(today) ? today : previousDayStart(today);
  while (trainingDays.has(dayCursor)) {
    dayChain++;
    dayCursor = previousDayStart(dayCursor);
  }

  return { weekStreak, dayChain };
}

/** Day-level activity map for the calendar heatmap: dayStart → session count. */
export function trainingDayCounts(
  sessionStarts: ReadonlyArray<number>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ts of sessionStarts) {
    const day = startOfDay(ts);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}
