"use client";

import { Bell, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { EventCard } from "@/components/event-card";
import { EventPageModal } from "@/components/event-page-modal";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { createEvent, deleteEvent, updateEvent } from "@/lib/data-store";
import {
  addMonths,
  format,
  getCalendarGridDays,
  isDayInMonth,
  isEventOnDay,
  monthLabel,
  subMonths
} from "@/lib/date-utils";
import type { AssignmentRole, Event } from "@/lib/types";
import { assignmentRolesForEventType } from "@/lib/gamification";

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function CalendarPage() {
  const { data, refresh, updateData } = useApp();
  const [month, setMonth] = useState(() => new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; eventId: string } | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingDayRef = useRef<Set<string>>(new Set());
  const lastDragEndedAtRef = useRef(0);

  const calendarDays = useMemo(() => getCalendarGridDays(month), [month]);
  const selectedEvent = data.events.find((event) => event.id === selectedEventId) ?? null;

  useEffect(
    () => () => {
      clearLongPressTimer();
    },
    []
  );

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function startEventLongPress(eventId: string, pointerEvent: ReactPointerEvent<HTMLButtonElement>) {
    if (pointerEvent.pointerType === "mouse") {
      return;
    }
    pointerEvent.stopPropagation();
    clearLongPressTimer();
    const { clientX, clientY } = pointerEvent;
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ x: clientX, y: clientY, eventId });
      longPressTimerRef.current = null;
    }, 650);
  }

  async function createEventOnDay(day: Date) {
    const dayKey = format(day, "yyyy-MM-dd");
    if (creatingDayRef.current.has(dayKey)) {
      return;
    }
    creatingDayRef.current.add(dayKey);
    const startsAt = new Date(day);
    startsAt.setHours(13, 0, 0, 0);
    const endsAt = new Date(day);
    endsAt.setHours(16, 0, 0, 0);
    const optimisticEvent: Event = {
      id: `optimistic-event-${Date.now()}`,
      title: "Neue Veranstaltung",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      location: "",
      eventType: "",
      status: "Nicht begonnen",
      techNeeds: "",
      notes: "",
      presentationFiles: [],
      createdAt: new Date().toISOString()
    };

    updateData((current) => ({ ...current, events: [optimisticEvent, ...current.events] }));
    setSelectedEventId(optimisticEvent.id);

    try {
      const event = await createEvent({
        title: optimisticEvent.title,
        startsAt: optimisticEvent.startsAt,
        endsAt: optimisticEvent.endsAt,
        location: optimisticEvent.location,
        eventType: optimisticEvent.eventType,
        status: optimisticEvent.status,
        techNeeds: optimisticEvent.techNeeds,
        notes: optimisticEvent.notes,
        presentationFiles: optimisticEvent.presentationFiles
      });
      updateData((current) => ({
        ...current,
        events: [
          event,
          ...current.events.filter(
            (item) =>
              item.id !== optimisticEvent.id &&
              item.id !== event.id &&
              !(item.id.startsWith("optimistic-event-") && eventSignature(item) === eventSignature(event))
          )
        ]
      }));
      setSelectedEventId(event.id);
    } catch (error) {
      updateData((current) => ({
        ...current,
        events: current.events.filter((item) => item.id !== optimisticEvent.id)
      }));
      setSelectedEventId(null);
      console.error("Veranstaltung konnte nicht erstellt werden:", error);
    } finally {
      creatingDayRef.current.delete(dayKey);
    }
  }

  async function moveEventToDay(eventId: string, targetDay: Date) {
    const event = data.events.find((item) => item.id === eventId);
    if (!event || event.id.startsWith("optimistic-event-")) {
      return;
    }

    const nextTimes = moveEventTimesToDay(event, targetDay);
    if (event.startsAt === nextTimes.startsAt && event.endsAt === nextTimes.endsAt) {
      return;
    }

    const previousTimes = { startsAt: event.startsAt, endsAt: event.endsAt };
    const saveMove = updateEvent(eventId, nextTimes);
    updateData((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === eventId ? { ...item, ...nextTimes } : item))
    }));

    try {
      await saveMove;
    } catch (error) {
      updateData((current) => ({
        ...current,
        events: current.events.map((item) => (item.id === eventId ? { ...item, ...previousTimes } : item))
      }));
      console.error("Veranstaltung konnte nicht verschoben werden:", error);
    }
  }

  return (
    <RouteGuard>
      <AppShell title="Veranstaltungskalender" contentClassName="calendar-content" titleIcon={<Bell size={30} />}>
        <section className="calendar-board-wrap">
          <div className="calendar-board-toolbar">
            <div className="calendar-month-label">{monthLabel(month)}</div>
            <div className="calendar-actions">
              <button className="button compact" type="button" onClick={() => setMonth(new Date())}>
                Heute
              </button>
              <button className="icon-button" type="button" aria-label="Vorheriger Monat" onClick={() => setMonth(subMonths(month, 1))}>
                <ChevronLeft size={18} />
              </button>
              <button className="icon-button" type="button" aria-label="Nächster Monat" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="calendar-board" aria-label="Monatskalender">
            {weekdays.map((weekday) => (
              <div className="calendar-weekday" key={weekday}>
                {weekday}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = uniqueEvents(data.events)
                  .filter((event) => isEventOnDay(event.startsAt, day))
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
              const inCurrentMonth = isDayInMonth(day, month);
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              const dayClassName = [
                "calendar-day",
                inCurrentMonth ? "" : "is-muted",
                isToday ? "is-today" : "",
                dayEvents.length ? "has-events" : "",
                dragOverDayKey === dayKey ? "is-drop-target" : ""
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={day.toISOString()}
                  className={dayClassName}
                  onDragEnter={(dragEvent) => {
                    if (!draggingEventId) {
                      return;
                    }
                    dragEvent.preventDefault();
                    setDragOverDayKey(dayKey);
                  }}
                  onDragOver={(dragEvent) => {
                    if (!draggingEventId) {
                      return;
                    }
                    dragEvent.preventDefault();
                    dragEvent.dataTransfer.dropEffect = "move";
                    setDragOverDayKey(dayKey);
                  }}
                  onDrop={(dragEvent) => {
                    const eventId = dragEvent.dataTransfer.getData("application/x-ak-motion-event") || draggingEventId;
                    if (!eventId) {
                      return;
                    }
                    dragEvent.preventDefault();
                    setDraggingEventId(null);
                    setDragOverDayKey(null);
                    lastDragEndedAtRef.current = Date.now();
                    void moveEventToDay(eventId, day);
                  }}
                >
                  <button
                    className="calendar-add-button"
                    type="button"
                    aria-label={`Veranstaltung am ${format(day, "dd.MM.yyyy")} hinzufügen`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      createEventOnDay(day);
                    }}
                  >
                    <Plus size={20} />
                  </button>
                  <div className="calendar-day-header">
                    <span className="day-number">{format(day, "d")}</span>
                    <span>{weekdays[(day.getDay() + 6) % 7]}</span>
                  </div>
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      compact
                      staffingComplete={isEventStaffed(event, data.assignments)}
                      onOpen={() => {
                        if (Date.now() - lastDragEndedAtRef.current < 180) {
                          return;
                        }
                        setSelectedEventId(event.id);
                      }}
                      onContextMenu={(contextEvent) => {
                        contextEvent.preventDefault();
                        contextEvent.stopPropagation();
                        setContextMenu({ x: contextEvent.clientX, y: contextEvent.clientY, eventId: event.id });
                      }}
                      onDragStart={(dragEvent) => {
                        clearLongPressTimer();
                        setDraggingEventId(event.id);
                        dragEvent.dataTransfer.effectAllowed = "move";
                        dragEvent.dataTransfer.setData("application/x-ak-motion-event", event.id);
                        dragEvent.dataTransfer.setData("text/plain", event.title);
                      }}
                      onDragEnd={() => {
                        setDraggingEventId(null);
                        setDragOverDayKey(null);
                        lastDragEndedAtRef.current = Date.now();
                      }}
                      onLongPress={(pointerEvent) => startEventLongPress(event.id, pointerEvent)}
                      onLongPressCancel={clearLongPressTimer}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {selectedEvent ? (
          <EventPageModal event={selectedEvent as Event} onClose={() => setSelectedEventId(null)} />
        ) : null}

        {contextMenu ? (
          <div className="context-scrim" role="presentation" onClick={() => setContextMenu(null)}>
            <div
              className="calendar-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(contextMenu.eventId);
                  setContextMenu(null);
                }}
              >
                Öffnen
              </button>
              <button
                className="danger"
                type="button"
                onClick={async () => {
                  const eventId = contextMenu.eventId;
                  updateData((current) => ({
                    ...current,
                    events: current.events.filter((event) => event.id !== eventId),
                    assignments: current.assignments.filter((assignment) => assignment.eventId !== eventId),
                    attendance: current.attendance.filter((attendance) => attendance.eventId !== eventId),
                    availability: current.availability.filter((availability) => availability.eventId !== eventId)
                  }));
                  await deleteEvent(contextMenu.eventId);
                  if (selectedEventId === eventId) {
                    setSelectedEventId(null);
                  }
                  setContextMenu(null);
                  void refresh();
                }}
              >
                <Trash2 size={15} />
                Löschen
              </button>
            </div>
          </div>
        ) : null}
      </AppShell>
    </RouteGuard>
  );
}

function isEventStaffed(event: Event, assignments: Array<{ eventId: string; role: AssignmentRole }>) {
  const requiredRoles = assignmentRolesForEventType(event.eventType).filter((role) => role === "Ton" || role === "Licht");
  return requiredRoles.every((role) => assignments.some((assignment) => assignment.eventId === event.id && assignment.role === role));
}

function eventSignature(event: Event) {
  return [event.title.trim().toLowerCase(), event.startsAt, event.endsAt, event.location.trim().toLowerCase()].join("|");
}

function moveEventTimesToDay(event: Event, targetDay: Date) {
  const currentStart = new Date(event.startsAt);
  const currentEnd = new Date(event.endsAt);
  const durationMs = Math.max(0, currentEnd.getTime() - currentStart.getTime());
  const nextStart = new Date(targetDay);
  nextStart.setHours(currentStart.getHours(), currentStart.getMinutes(), currentStart.getSeconds(), currentStart.getMilliseconds());
  const nextEnd = new Date(nextStart.getTime() + durationMs);

  return {
    startsAt: nextStart.toISOString(),
    endsAt: nextEnd.toISOString()
  };
}

function uniqueEvents(events: Event[]) {
  const savedEventSignatures = new Set(
    events.filter((event) => !event.id.startsWith("optimistic-event-")).map((event) => eventSignature(event))
  );
  const seen = new Set<string>();
  return events.filter((event) => {
    if (event.id.startsWith("optimistic-event-") && savedEventSignatures.has(eventSignature(event))) {
      return false;
    }
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}
