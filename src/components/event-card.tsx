"use client";

import { CheckCircle2, Clock, MapPin, UserCheck } from "lucide-react";
import type { MouseEvent } from "react";
import { addAssignment, markAttendance, setAvailability } from "@/lib/data-store";
import { formatDateTime, formatTimeRange } from "@/lib/date-utils";
import type { AssignmentRole, Event } from "@/lib/types";
import { useApp } from "@/components/app-provider";

const assignmentRoles: AssignmentRole[] = ["Ton", "Licht", "Umbau", "Kleine"];

export function EventCard({
  event,
  compact = false,
  staffingComplete,
  onOpen,
  onContextMenu
}: {
  event: Event;
  compact?: boolean;
  staffingComplete?: boolean;
  onOpen?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}) {
  const { data, session, refresh, updateData } = useApp();
  const canManageCalendar = Boolean(session);
  const technicians = data.profiles;
  const availability = data.availability.filter((item) => item.eventId === event.id);
  const assignments = data.assignments.filter((item) => item.eventId === event.id);
  const attendance = data.attendance.filter((item) => item.eventId === event.id && item.attended);
  const currentAvailability = availability.find((item) => item.profileId === session?.id);

  if (compact) {
    return (
      <button
        className={[
          "calendar-event-pill",
          staffingComplete === undefined ? "" : staffingComplete ? "is-staffed" : "is-understaffed"
        ]
          .filter(Boolean)
          .join(" ")}
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          onOpen?.();
        }}
        onContextMenu={onContextMenu}
      >
        <span className="calendar-event-time">{formatTimeRange(event.startsAt, event.endsAt)}</span>
        <span className="calendar-event-title">{event.title}</span>
      </button>
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
            onClick={async () => {
              if (session) {
                await setAvailability(event.id, session.id, "committed");
                refresh();
              }
            }}
          >
            Auf jeden Fall dabei
          </button>
          <button
            className={currentAvailability?.status === "backup" ? "button primary" : "button"}
            type="button"
            onClick={async () => {
              if (session) {
                await setAvailability(event.id, session.id, "backup");
                refresh();
              }
            }}
          >
            Ersatz
          </button>
        </div>
      ) : null}

      {canManageCalendar ? (
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
                  onChange={async (eventValue) => {
                    if (eventValue.target.value) {
                      const profileId = eventValue.target.value;
                      const optimisticAssignment = {
                        id: `optimistic-assignment-${event.id}-${profileId}-${role}`,
                        eventId: event.id,
                        profileId,
                        role,
                        createdAt: new Date().toISOString()
                      };
                      updateData((current) =>
                        current.assignments.some(
                          (assignment) => assignment.eventId === event.id && assignment.profileId === profileId && assignment.role === role
                        )
                          ? current
                          : { ...current, assignments: [...current.assignments, optimisticAssignment] }
                      );
                      eventValue.target.value = "";
                      try {
                        await addAssignment(event.id, profileId, role);
                      } catch (error) {
                        updateData((current) => ({
                          ...current,
                          assignments: current.assignments.filter((assignment) => assignment.id !== optimisticAssignment.id)
                        }));
                        console.error("Techniker konnte nicht eingeteilt werden:", error);
                      }
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
                  onClick={async () => {
                    if (canManageCalendar) {
                      await markAttendance(event.id, item.profileId, item.role);
                      refresh();
                    }
                  }}
                  title={canManageCalendar ? "Anwesenheit umschalten" : undefined}
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
