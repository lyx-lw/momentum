export type WeeklyPeriodPreset = 'current' | 'previous';

export interface WeeklyDateRange {
  start: Date;
  endExclusive: Date;
  isPartialPeriod: boolean;
}
function startOfLocalWeek(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function getWeeklyDateRange(
  preset: WeeklyPeriodPreset,
  now = new Date(),
): WeeklyDateRange {
  const start = startOfLocalWeek(now);
  if (preset === 'previous') start.setDate(start.getDate() - 7);

  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 7);

  return {
    start,
    endExclusive,
    isPartialPeriod: preset === 'current' && now < endExclusive,
  };
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
