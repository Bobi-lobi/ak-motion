"use client";

import { CheckCircle2, Clock, MapPin, UserCheck } from "lucide-react";
import type { MouseEvent } from "react";
import { addAssignment, markAttendance, setAvailability } from "@/lib/data-store";
import { formatDateTime, formatTimeRange } from "@/lib/date-utils";
import type { AssignmentRole, Event } from "@/lib/types";
import { useApp } from "@/components/app-provider";

const assignmentRoles: AssignmentRole[] = ["Ton", "Licht", "Umbau"];

export function EventCard({
  event,
  compact = false,
  onOpen,
  onContextMenu
}: {
  event: Event;
  compact?: boolean;
  onOpen?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}) {
  const { data, session, isAdmin, refresh } = useApp();
  const technicians = data.profiles.filter((profile) => profile.role === "technician");
  const availability = data.availability.filter((item) => item.eventId === event.id);
  const assignments = data.assignments.filter((item) => item.eventId === event.id);
  const attendance = data.attendance.filter((item) => item.eventId === event.id && item.attended);
  const currentAvailability = availability.find((item) => item.profileId === session?.id);

  if (compact) {
    return (
      <div
        className="calendar-event-pill"
        onClick={() => onOpen?.()}
        onContextMenu={onContextMenu}
      >
        <span className="calendar-event-time">{formatTimeRange(event.startsAt, event.endsAt)}</span>
        <span className="calendar-event-title">{event.title}</span>
      </div>
    );
  }

  return (
    <article className="event-card">
      <div className="event-card-header">
        <div>
          <h2>{event.title}</h2>
          <p>
            <Clock size={15} />
            {formatDateTime(event.startsAt)} Uhr ({formatTimeRange(event.startsAt, event.endsAt)})
          </p>
          <p>
            <MapPin size={15} />
            {event.location}
          </p>
        </div>
        <span className="pill">{event.eventType}</span>
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Technik</dt>
          <dd>{event.techNeeds}</dd>
        </div>
        <div>
          <dt>Notizen</dt>
          <dd>{notePreview(event.notes)}</dd>
        </div>
      </dl>

      {session?.role === "technician" ? (
        <div className="button-row">
          <button
            className={currentAvailability?.status === "committed" ? "button primary" : "button"}
            type="button"
            onClick={() => {
              if (session) {
                setAvailability(event.id, session.id, "committed");
                refresh();
              }
            }}
          >
            Auf jeden Fall dabei
          </button>
          <button
            className={currentAvailability?.status === "backup" ? "button primary" : "button"}
            type="button"
            onClick={() => {
              if (session) {
                setAvailability(event.id, session.id, "backup");
                refresh();
              }
            }}
          >
            Ersatz
          </button>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="admin-panel">
          <h3>
            <UserCheck size={16} />
            Einteilung
          </h3>
          <div className="assignment-grid">
            {assignmentRoles.map((role) => (
              <label key={role}>
                <span>{role}</span>
                <select
                  defaultValue=""
                  onChange={(eventValue) => {
                    if (eventValue.target.value) {
                      addAssignment(event.id, eventValue.target.value, role);
                      eventValue.target.value = "";
                      refresh();
                    }
                  }}
                >
                  <option value="">Techniker wählen</option>
                  {technicians.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="split-list">
        <section>
          <h3>Rückmeldungen</h3>
          {availability.length ? (
            availability.map((item) => {
              const profile = data.profiles.find((profileItem) => profileItem.id === item.profileId);
              return (
                <span key={item.id} className="status-line">
                  {profile?.name ?? "Unbekannt"}: {item.status === "committed" ? "auf jeden Fall dabei" : "Ersatz"}
                </span>
              );
            })
          ) : (
            <span className="muted">Noch keine Rückmeldungen</span>
          )}
        </section>

        <section>
          <h3>Final eingeteilt</h3>
          {assignments.length ? (
            assignments.map((item) => {
              const profile = data.profiles.find((profileItem) => profileItem.id === item.profileId);
              const attended = attendance.some((entry) => entry.profileId === item.profileId && entry.role === item.role);
              return (
                <button
                  key={item.id}
                  className={attended ? "status-line clickable is-done" : "status-line clickable"}
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      markAttendance(event.id, item.profileId, item.role);
                      refresh();
                    }
                  }}
                  title={isAdmin ? "Anwesenheit umschalten" : undefined}
                >
                  <CheckCircle2 size={15} />
                  {profile?.name ?? "Unbekannt"}: {item.role}
                </button>
              );
            })
          ) : (
            <span className="muted">Noch niemand eingeteilt</span>
          )}
        </section>
      </div>
    </article>
  );
}

function notePreview(notes: string) {
  if (!notes.trim()) {
    return "Keine Notizen";
  }

  if (typeof document === "undefined") {
    return notes;
  }

  const template = document.createElement("template");
  template.innerHTML = notes;
  return template.content.textContent?.trim() || "Keine Notizen";
}
