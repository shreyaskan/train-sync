export { cn } from "cn";

// Adding a fixed N * 24h in milliseconds breaks across a DST transition (the
// result lands an hour off, which can round into the wrong calendar day) —
// this instead re-derives the date from calendar fields, which the JS Date
// constructor resolves using the correct local offset for the target day.
export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}
