import {
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { de } from "date-fns/locale";

export function formatDateTime(value: string) {
  return format(parseISO(value), "dd.MM.yyyy, HH:mm", { locale: de });
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  return `${format(parseISO(startsAt), "HH:mm", { locale: de })}-${format(parseISO(endsAt), "HH:mm", {
    locale: de
  })}`;
}

export function monthLabel(month: Date) {
  return format(month, "MMMM yyyy", { locale: de });
}

export function getMonthDays(month: Date) {
  return eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month)
  });
}

export function getCalendarGridDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  });
}

export function isEventOnDay(startsAt: string, day: Date) {
  return isSameDay(parseISO(startsAt), day);
}

export function isInMonth(value: string, month: Date) {
  return isSameMonth(parseISO(value), month);
}

export function isDayInMonth(day: Date, month: Date) {
  return isSameMonth(day, month);
}

export { addMonths, format, parseISO, subMonths };
