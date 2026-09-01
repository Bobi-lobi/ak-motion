"use client";

import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import deLocale from "@fullcalendar/core/locales/de";
import type { DateSelectArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type { Event } from "@/lib/types";

export function CalendarWeekView({
  date,
  events,
  onCreate,
  onOpen,
  onTimeChange
}: {
  date: Date;
  events: Event[];
  onCreate: (start: Date, end: Date) => void;
  onOpen: (eventId: string) => void;
  onTimeChange: (eventId: string, startsAt: string, endsAt: string, revert: () => void) => void;
}) {
  function handleDrop(info: EventDropArg | EventResizeDoneArg) {
    const start = info.event.start;
    const end = info.event.end;
    if (!start || !end) {
      info.revert();
      return;
    }
    onTimeChange(info.event.id, start.toISOString(), end.toISOString(), info.revert);
  }

  return (
    <div className="calendar-week-view" aria-label="Wochenkalender">
      <FullCalendar
        key={date.toISOString().slice(0, 10)}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={date}
        locale={deLocale}
        firstDay={1}
        headerToolbar={false}
        allDaySlot={false}
        nowIndicator
        selectable
        selectMirror
        editable
        eventResizableFromStart
        longPressDelay={450}
        eventLongPressDelay={450}
        selectLongPressDelay={450}
        slotMinTime="07:00:00"
        slotMaxTime="23:00:00"
        scrollTime="11:00:00"
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        height="auto"
        expandRows
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.startsAt,
          end: event.endsAt,
          classNames: event.eventType.trim().toLowerCase() === "termin" ? ["is-appointment"] : []
        }))}
        select={(info: DateSelectArg) => onCreate(info.start, info.end)}
        eventClick={(info: EventClickArg) => onOpen(info.event.id)}
        eventDrop={handleDrop}
        eventResize={handleDrop}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        dayHeaderFormat={{ weekday: "short", day: "2-digit", month: "2-digit" }}
      />
    </div>
  );
}
