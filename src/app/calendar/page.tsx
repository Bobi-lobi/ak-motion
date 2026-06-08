"use client";

import { Bell, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EventCard } from "@/components/event-card";
import { EventPageModal } from "@/components/event-page-modal";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { createEvent, deleteEvent } from "@/lib/data-store";
import {
  addMonths,
  format,
  getCalendarGridDays,
  isDayInMonth,
  isEventOnDay,
  monthLabel,
  subMonths
} from "@/lib/date-utils";
import type { Event } from "@/lib/types";

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function CalendarPage() {
  const { data, refresh } = useApp();
  const [month, setMonth] = useState(() => new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; eventId: string } | null>(null);

  const calendarDays = useMemo(() => getCalendarGridDays(month), [month]);
  const selectedEvent = data.events.find((event) => event.id === selectedEventId) ?? null;

  async function createEventOnDay(day: Date) {
    const startsAt = new Date(day);
    startsAt.setHours(13, 0, 0, 0);
    const endsAt = new Date(day);
    endsAt.setHours(16, 0, 0, 0);
    const event = await createEvent({
      title: "Neue Veranstaltung",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      location: "",
      eventType: "",
      status: "Nicht begonnen",
      techNeeds: "",
      notes: "",
      presentationFiles: []
    });
    refresh();
    setSelectedEventId(event.id);
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
              const dayEvents = data.events
                  .filter((event) => isEventOnDay(event.startsAt, day))
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
              const inCurrentMonth = isDayInMonth(day, month);
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              const dayClassName = [
                "calendar-day",
                inCurrentMonth ? "" : "is-muted",
                isToday ? "is-today" : "",
                dayEvents.length ? "has-events" : ""
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={day.toISOString()}
                  className={dayClassName}
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
                      onOpen={() => setSelectedEventId(event.id)}
                      onContextMenu={(contextEvent) => {
                        contextEvent.preventDefault();
                        contextEvent.stopPropagation();
                        setContextMenu({ x: contextEvent.clientX, y: contextEvent.clientY, eventId: event.id });
                      }}
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
                  await deleteEvent(contextMenu.eventId);
                  if (selectedEventId === contextMenu.eventId) {
                    setSelectedEventId(null);
                  }
                  setContextMenu(null);
                  refresh();
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
