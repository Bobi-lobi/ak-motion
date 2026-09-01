import type { Event } from "@/lib/types";

const SCHOOL_YEAR_START_MONTH = 8;
const SCHOOL_YEAR_START_DAY = 15;
const berlinDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
  year: "numeric"
});

function berlinDateParts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    berlinDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return { day: parts.day, month: parts.month - 1, year: parts.year };
}

export function schoolYearForDate(value: Date | string = new Date()) {
  const { day, month, year } = berlinDateParts(value);
  return month > SCHOOL_YEAR_START_MONTH || (month === SCHOOL_YEAR_START_MONTH && day >= SCHOOL_YEAR_START_DAY)
    ? year
    : year - 1;
}

export function schoolYearLabel(startYear: number) {
  const shortYear = (year: number) => String(year).slice(-2).padStart(2, "0");
  return `${shortYear(startYear)}/${shortYear(startYear + 1)}`;
}

export function isDateInSchoolYear(value: Date | string, startYear: number) {
  return schoolYearForDate(value) === startYear;
}

export function monthInBerlin(value: Date | string) {
  return berlinDateParts(value).month;
}

export function schoolYearOptions(events: Event[], now = new Date()) {
  const years = new Set<number>([schoolYearForDate(now)]);
  events.forEach((event) => years.add(schoolYearForDate(event.startsAt)));
  return Array.from(years).sort((a, b) => b - a);
}

export const schoolYearMonths = [
  { label: "Sep", month: 8 },
  { label: "Okt", month: 9 },
  { label: "Nov", month: 10 },
  { label: "Dez", month: 11 },
  { label: "Jan", month: 0 },
  { label: "Feb", month: 1 },
  { label: "Mär", month: 2 },
  { label: "Apr", month: 3 },
  { label: "Mai", month: 4 },
  { label: "Jun", month: 5 },
  { label: "Jul", month: 6 },
  { label: "Aug", month: 7 }
];
