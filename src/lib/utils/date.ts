/**
 * Returns the ISO 8601 week number for a given date.
 * Week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Rotates an array by n positions (wraps around).
 * rotateArray([1,2,3,4,5], 2) => [3,4,5,1,2]
 */
export function rotateArray<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return arr;
  const offset = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(offset), ...arr.slice(0, offset)];
}
