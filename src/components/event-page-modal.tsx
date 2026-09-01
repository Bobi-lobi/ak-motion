"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  Mail,
  MapPin,
  Paperclip,
  Trophy,
  Bold,
  Italic,
  Strikethrough,
  Type,
  UsersRound,
  X
} from "lucide-react";
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createProfile, addAssignment, removeAssignment, updateEvent } from "@/lib/data-store";
import { addMonths, format, getCalendarGridDays, isDayInMonth, parseISO, subMonths, monthLabel } from "@/lib/date-utils";
import type { AssignmentRole, Event, Profile, SessionUser } from "@/lib/types";
import { useApp } from "@/components/app-provider";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { assignmentRolesForEventType, eventMaxXp } from "@/lib/gamification";
import { uploadAppMedia } from "@/lib/media-storage";

const statusDefaults = ["Nicht begonnen", "In Planung", "Bereit", "Abgeschlossen"];
const typePalette = ["#9b6a64", "#7d609a", "#5f7fa3", "#6f8f72", "#a18452", "#8b6f93"];
const pageIconOptions = ["📄", "📌", "✅", "🎬", "🎤", "🎧", "💡", "🎵", "📷", "🧰", "📅", "⭐", "🔥", "🚀", "🏫", "🎭"];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
type BlockHandle = { authorAvatar?: string; authorName?: string; id: string; top: number; height: number };
type LiveTypingState = {
  avatarUrl?: string;
  blockId: string;
  blockHtml: string;
  caretTop?: number;
  clientId: string;
  html: string;
  name: string;
};
type YjsEditorPayload = {
  clientId: string;
  documentKey: string;
  update: string;
};
type EventFieldPatchPayload = {
  clientId: string;
  eventId: string;
  patch: Partial<Event>;
};
type TableControlsPosition = { top: number; left: number; width: number; height: number };
type SlashCommand = {
  action?: "audio" | "image" | "page" | "video";
  accept?: string;
  label: string;
  description: string;
  html?: string;
  keywords?: string[];
  section: "basis" | "medien";
};
type ActivePage = {
  content: string;
  element: HTMLElement;
  icon: string;
  id: string;
  title: string;
};
type DropIndicator = { top: number; targetId: string; placement: "before" | "after" };
type BlockContextMenu = { blockId: string; x: number; y: number };

export function EventPageModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { data, session, isAdmin, refresh, updateData } = useApp();
  const [draftEvent, setDraftEvent] = useState(event);
  const eventFieldChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const eventFieldChannelReadyRef = useRef(false);
  const eventFieldClientIdRef = useRef(`event-client-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const pendingEventFieldPayloadRef = useRef<EventFieldPatchPayload | null>(null);
  const pendingPatchRef = useRef<Partial<Event>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestEventIdRef = useRef(event.id);
  const technicians = data.profiles;
  const assignments = data.assignments.filter((item) => item.eventId === event.id);
  const visibleAssignmentRoles = assignmentRolesForEventType(draftEvent.eventType);
  const typeOptions = Array.from(
    new Set([
      "Schulische Veranstaltung",
      "Probe",
      "Feier",
      "Vortrag",
      "Aufführung",
      "Konzert",
      "Termin",
      ...data.events.map((item) => item.eventType).filter(Boolean)
    ])
  );
  const locationOptions = Array.from(new Set(["Aula", "Bühne", "Musikraum", "Sporthalle", ...data.events.map((item) => item.location).filter(Boolean)]));
  const canChooseAllTechnicians = Boolean(session);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    const channel = supabaseClient
      .channel(`ak-motion-event-fields-${event.id}`)
      .on("broadcast", { event: "event_patch" }, ({ payload }) => {
        const eventPatch = payload as EventFieldPatchPayload;
        if (
          !eventPatch ||
          eventPatch.clientId === eventFieldClientIdRef.current ||
          eventPatch.eventId !== event.id ||
          !eventPatch.patch
        ) {
          return;
        }

        setDraftEvent((current) => {
          const pendingKeys = new Set(Object.keys(pendingPatchRef.current));
          const safePatch = Object.fromEntries(
            Object.entries(eventPatch.patch).filter(([key]) => !pendingKeys.has(key))
          ) as Partial<Event>;
          return Object.keys(safePatch).length ? { ...current, ...safePatch } : current;
        });
        updateData((current) => ({
          ...current,
          events: current.events.map((item) => (item.id === event.id ? { ...item, ...eventPatch.patch } : item))
        }));
      })
      .subscribe((status) => {
        eventFieldChannelReadyRef.current = status === "SUBSCRIBED";
        if (eventFieldChannelReadyRef.current && pendingEventFieldPayloadRef.current) {
          void channel.send({ type: "broadcast", event: "event_patch", payload: pendingEventFieldPayloadRef.current });
          pendingEventFieldPayloadRef.current = null;
        }
      });
    eventFieldChannelRef.current = channel;

    return () => {
      eventFieldChannelReadyRef.current = false;
      eventFieldChannelRef.current = null;
      pendingEventFieldPayloadRef.current = null;
      void supabaseClient.removeChannel(channel);
    };
  }, [event.id, updateData]);

  useEffect(() => {
    if (event.id !== latestEventIdRef.current) {
      const previousPatch = pendingPatchRef.current;
      if (Object.keys(previousPatch).length) {
        void updateEvent(latestEventIdRef.current, previousPatch);
      }
      latestEventIdRef.current = event.id;
      setDraftEvent(event);
      pendingPatchRef.current = {};
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }

    if (!Object.keys(pendingPatchRef.current).length) {
      setDraftEvent(event);
    }
  }, [event]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      const patch = pendingPatchRef.current;
      pendingPatchRef.current = {};
      if (Object.keys(patch).length) {
        void updateEvent(latestEventIdRef.current, patch);
      }
    },
    []
  );

  async function flushEventPatch() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!Object.keys(patch).length) {
      return;
    }
    await updateEvent(latestEventIdRef.current, patch);
  }

  function patchEvent(patch: Partial<Event>, options: { immediate?: boolean } = {}) {
    setDraftEvent((current) => ({ ...current, ...patch }));
    updateData((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === latestEventIdRef.current ? { ...item, ...patch } : item))
    }));
    broadcastEventFieldPatch(patch);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    if (options.immediate) {
      void flushEventPatch();
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      void flushEventPatch();
    }, 550);
  }

  function broadcastEventFieldPatch(patch: Partial<Event>) {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    const payload: EventFieldPatchPayload = {
      clientId: eventFieldClientIdRef.current,
      eventId: latestEventIdRef.current,
      patch
    };

    if (!eventFieldChannelReadyRef.current || !eventFieldChannelRef.current) {
      pendingEventFieldPayloadRef.current = pendingEventFieldPayloadRef.current
        ? { ...pendingEventFieldPayloadRef.current, patch: { ...pendingEventFieldPayloadRef.current.patch, ...patch } }
        : payload;
      return;
    }

    void eventFieldChannelRef.current.send({ type: "broadcast", event: "event_patch", payload });
  }

  function updateDate(dateValue: string) {
    const startTime = format(parseISO(draftEvent.startsAt), "HH:mm");
    const endTime = format(parseISO(draftEvent.endsAt), "HH:mm");
    patchEvent({
      startsAt: new Date(`${dateValue}T${startTime}:00`).toISOString(),
      endsAt: new Date(`${dateValue}T${endTime}:00`).toISOString()
    }, { immediate: true });
  }

  function updateTime(which: "start" | "end", timeValue: string) {
    if (!timePattern.test(timeValue)) {
      return;
    }

    const dateValue = format(parseISO(draftEvent.startsAt), "yyyy-MM-dd");
    patchEvent({
      [which === "start" ? "startsAt" : "endsAt"]: new Date(`${dateValue}T${timeValue}:00`).toISOString()
    }, { immediate: true });
  }

  return (
    <div className="page-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="page-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${draftEvent.title} bearbeiten`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="page-modal-actions">
          {draftEvent.eventType.trim().toLowerCase() === "termin" ? (
            <div className="event-xp-badge is-neutral" title="Termine geben keine XP">
              <UsersRound size={17} />
              <span>Gemeinsamer Termin</span>
            </div>
          ) : (
            <div className="event-xp-badge" title="Maximale XP für eine Person bei bester Rolle und markierter Anwesenheit">
              <Trophy size={17} />
              <span>Max {eventMaxXp(draftEvent)} XP</span>
            </div>
          )}
          <button className="icon-button ghost" type="button" aria-label="Fenster schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="page-modal-inner">
          <input
            className="notion-title-input"
            value={draftEvent.title}
            onChange={(changeEvent) => patchEvent({ title: changeEvent.target.value })}
            aria-label="Veranstaltungstitel"
          />

          <div className="property-grid">
            {visibleAssignmentRoles.map((role) => (
              <PropertyRow key={role} icon={<UsersRound size={18} />} label={role}>
                <TechnicianField
                  role={role}
                  eventId={event.id}
                  technicians={technicians}
                  assignments={assignments}
                  canChooseAll={canChooseAllTechnicians}
                  canCreateTechnicians={isAdmin}
                  currentUserId={session?.id}
                  onChange={refresh}
                  onOptimisticAdd={(profileId, role) => {
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
                    return optimisticAssignment.id;
                  }}
                  onOptimisticRemove={(profileId, role) => {
                    updateData((current) => ({
                      ...current,
                      assignments: current.assignments.filter(
                        (assignment) => !(assignment.eventId === event.id && assignment.profileId === profileId && assignment.role === role)
                      ),
                      attendance: current.attendance.filter(
                        (attendance) => !(attendance.eventId === event.id && attendance.profileId === profileId && attendance.role === role)
                      )
                    }));
                  }}
                  onOptimisticRollback={(assignmentId) => {
                    updateData((current) => ({
                      ...current,
                      assignments: current.assignments.filter((assignment) => assignment.id !== assignmentId)
                    }));
                  }}
                />
              </PropertyRow>
            ))}

            <PropertyRow icon={<Mail size={18} />} label="Ansprechpartner">
              <input
                className="property-input"
                value={draftEvent.contactName ?? ""}
                onChange={(changeEvent) => patchEvent({ contactName: changeEvent.target.value })}
                placeholder="Leer"
              />
            </PropertyRow>
            <PropertyRow icon={<Mail size={18} />} label="E-Mail">
              <input
                className="property-input"
                value={draftEvent.contactEmail ?? ""}
                onChange={(changeEvent) => patchEvent({ contactEmail: changeEvent.target.value })}
                placeholder="Leer"
                type="email"
              />
            </PropertyRow>
            <PropertyRow icon={<CalendarDays size={18} />} label="Datum">
              <DatePicker value={format(parseISO(draftEvent.startsAt), "yyyy-MM-dd")} onChange={updateDate} />
            </PropertyRow>
            <PropertyRow icon={<Clock size={18} />} label="Uhrzeit">
              <div className="time-input-row">
                <TimeInput
                  value={format(parseISO(draftEvent.startsAt), "HH:mm")}
                  onChange={(value) => updateTime("start", value)}
                  ariaLabel="Startzeit"
                />
                <span>-</span>
                <TimeInput
                  value={format(parseISO(draftEvent.endsAt), "HH:mm")}
                  onChange={(value) => updateTime("end", value)}
                  ariaLabel="Endzeit"
                />
              </div>
            </PropertyRow>
            <PropertyRow icon={<MapPin size={18} />} label="Ort">
              <TagSelect
                storageKey="ak-motion-location-options"
                value={draftEvent.location}
                defaults={locationOptions}
                emptyLabel="Leer"
                onChange={(value) => patchEvent({ location: value }, { immediate: true })}
              />
            </PropertyRow>
            <PropertyRow icon={<Hash size={18} />} label="Typ">
              <TagSelect
                storageKey="ak-motion-event-types"
                value={draftEvent.eventType}
                defaults={typeOptions}
                emptyLabel="Leer"
                onChange={(value) => patchEvent({ eventType: value }, { immediate: true })}
              />
            </PropertyRow>
            <PropertyRow icon={<CheckCircle2 size={18} />} label="Status">
              <TagSelect
                storageKey="ak-motion-status-options"
                value={draftEvent.status ?? "Nicht begonnen"}
                defaults={statusDefaults}
                emptyLabel="Leer"
                neutral
                onChange={(value) => patchEvent({ status: value }, { immediate: true })}
              />
            </PropertyRow>
            <PropertyRow icon={<Paperclip size={18} />} label="Präsentationen">
              {draftEvent.presentationFiles?.length ? (
                <div className="attachment-list compact">
                  {draftEvent.presentationFiles.map((file, index) => (
                    <a href={file.url} key={`${file.name}-${index}`} download={file.name} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                  ))}
                </div>
              ) : (
                <span className="property-empty">Keine Dateien</span>
              )}
            </PropertyRow>
          </div>

          <section className="notion-document">
            <h2>Notizen</h2>
            <SlashRichTextEditor
              key={event.id}
              value={draftEvent.notes}
              onChange={(changeEvent) => {
                patchEvent({ notes: changeEvent });
              }}
              placeholder="Ablauf, Aufbauplan, Sonderwünsche, Links oder interne Hinweise..."
              currentUser={session}
              realtimeKey={`event-notes-${event.id}`}
            />
          </section>
        </div>
      </section>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  ariaLabel
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(nextDraft: string) {
    const normalized = normalizeTime(nextDraft);
    if (!normalized) {
      setDraft(value);
      return;
    }

    setDraft(normalized);
    if (normalized !== value) {
      onChange(normalized);
    }
  }

  return (
    <input
      className="property-input time"
      value={draft}
      onBlur={() => commit(draft)}
      onChange={(changeEvent) => {
        const next = changeEvent.target.value;
        setDraft(next);
        if (timePattern.test(next)) {
          onChange(next);
        }
      }}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter") {
          keyEvent.currentTarget.blur();
        }
      }}
      placeholder="HH:MM"
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
    />
  );
}

function TechnicianField({
  role,
  eventId,
  technicians,
  assignments,
  canChooseAll,
  canCreateTechnicians,
  currentUserId,
  onChange,
  onOptimisticAdd,
  onOptimisticRemove,
  onOptimisticRollback
}: {
  role: AssignmentRole;
  eventId: string;
  technicians: Profile[];
  assignments: Array<{ profileId: string; role: AssignmentRole }>;
  canChooseAll: boolean;
  canCreateTechnicians: boolean;
  currentUserId?: string;
  onChange: () => void;
  onOptimisticAdd: (profileId: string, role: AssignmentRole) => string;
  onOptimisticRemove: (profileId: string, role: AssignmentRole) => void;
  onOptimisticRollback: (assignmentId: string) => void;
}) {
  const selectedIds = assignments.filter((assignment) => assignment.role === role).map((assignment) => assignment.profileId);
  const visibleTechnicians = canChooseAll
    ? technicians
    : technicians.filter((profile) => profile.id === currentUserId || selectedIds.includes(profile.id));

  return (
    <MultiTagPicker
      selected={selectedIds}
      options={visibleTechnicians.map((profile) => ({ avatarUrl: profile.avatarUrl, value: profile.id, label: profile.name }))}
      emptyLabel="Leer"
      canCreate={canCreateTechnicians}
      onAdd={async (profileId) => {
        const optimisticId = onOptimisticAdd(profileId, role);
        try {
          await addAssignment(eventId, profileId, role);
        } catch (error) {
          onOptimisticRollback(optimisticId);
          console.error("Techniker konnte nicht eingeteilt werden:", error);
        }
      }}
      onRemove={async (profileId) => {
        onOptimisticRemove(profileId, role);
        try {
          await removeAssignment(eventId, profileId, role);
        } catch (error) {
          onChange();
          console.error("Einteilung konnte nicht entfernt werden:", error);
        }
      }}
      onCreate={async (name) => {
        const profile = await createProfile(name, `${slugify(name)}@ak-motion.local`);
        const optimisticId = onOptimisticAdd(profile.id, role);
        try {
          await addAssignment(eventId, profile.id, role);
          onChange();
        } catch (error) {
          onOptimisticRollback(optimisticId);
          console.error("Techniker konnte nicht erstellt und eingeteilt werden:", error);
        }
      }}
    />
  );
}

function TagSelect({
  value,
  defaults,
  storageKey,
  emptyLabel,
  neutral = false,
  onChange
}: {
  value: string;
  defaults: string[];
  storageKey: string;
  emptyLabel: string;
  neutral?: boolean;
  onChange: (value: string) => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localOptions, setLocalOptions] = useState<string[]>(() => loadOptionSet(storageKey, defaults));
  const options = useMemo(() => Array.from(new Set(localOptions.filter(Boolean))), [localOptions]);
  const filtered = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()));
  useCloseOnOutside(pickerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    void supabase
      .from("app_options")
      .select("label")
      .eq("namespace", storageKey)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setLocalOptions(Array.from(new Set([...defaults, ...data.map((option) => option.label)])));
        }
      });
  }, [storageKey]);

  function saveOptions(next: string[]) {
    setLocalOptions(next);
    if (!hasSupabaseConfig) {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }

  async function createAndSelect(label: string) {
    const clean = label.trim();
    if (!clean) {
      return;
    }
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("app_options").upsert(
        {
          namespace: storageKey,
          label: clean
        },
        { onConflict: "namespace,label" }
      );
      if (error) {
        throw new Error(error.message);
      }
    }
    const next = Array.from(new Set([...options, clean]));
    saveOptions(next);
    setQuery("");
    onChange(clean);
    setOpen(false);
  }

  return (
    <div className="tag-picker" ref={pickerRef}>
      <button className="tag-picker-trigger" type="button" onClick={() => setOpen((current) => !current)}>
        <span
          className={value ? (neutral ? "property-tag neutral" : "property-tag") : "property-empty"}
          style={value ? { background: tagColor(value, neutral) } : undefined}
        >
          {value || emptyLabel}
        </span>
      </button>
      {open ? (
        <div className="tag-picker-menu">
          <div className="tag-input-row">
            {value ? (
              <span className={neutral ? "property-tag neutral" : "property-tag"} style={{ background: tagColor(value, neutral) }}>
                {value}
                <button type="button" onClick={() => onChange("")} aria-label={`${value} entfernen`}>
                  <X size={13} />
                </button>
              </span>
            ) : null}
            <input
              value={query}
              onChange={(changeEvent) => setQuery(changeEvent.target.value)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter") {
                  keyEvent.preventDefault();
                  void createAndSelect(query);
                }
              }}
              placeholder="Option auswählen oder erstellen"
            />
          </div>
          <span className="tag-menu-heading">Option auswählen oder erstellen</span>
          {filtered.map((option) => (
            <button
              className="tag-option"
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span className={neutral ? "property-tag neutral" : "property-tag"} style={{ background: tagColor(option, neutral) }}>
                {option}
              </span>
              <X
                size={15}
                onClick={async (clickEvent) => {
                  clickEvent.stopPropagation();
                  if (hasSupabaseConfig && supabase) {
                    const { error } = await supabase.from("app_options").delete().eq("namespace", storageKey).eq("label", option);
                    if (error) {
                      throw new Error(error.message);
                    }
                  }
                  saveOptions(options.filter((item) => item !== option));
                }}
              />
            </button>
          ))}
          {query.trim() && !options.includes(query.trim()) ? (
            <button className="tag-create-option" type="button" onClick={() => void createAndSelect(query)}>
              + "{query.trim()}" erstellen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MultiTagPicker({
  selected,
  options,
  emptyLabel,
  canCreate,
  onAdd,
  onRemove,
  onCreate
}: {
  selected: string[];
  options: Array<{ avatarUrl?: string; value: string; label: string }>;
  emptyLabel: string;
  canCreate?: boolean;
  onAdd: (value: string) => void | Promise<void>;
  onRemove: (value: string) => void | Promise<void>;
  onCreate?: (label: string) => void | Promise<void>;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const filtered = options.filter(
    (option) => !selected.includes(option.value) && option.label.toLowerCase().includes(query.toLowerCase())
  );
  useCloseOnOutside(pickerRef, () => setOpen(false), open);

  return (
    <div className="tag-picker" ref={pickerRef}>
      <button className="tag-picker-trigger" type="button" onClick={() => setOpen((current) => !current)}>
        <span className="chip-list">
          {selectedOptions.length ? (
            selectedOptions.map((option) => (
              <span className="people-chip" key={option.value}>
                <PersonAvatar name={option.label} src={option.avatarUrl} />
                {option.label}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onRemove(option.value);
                  }}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      onRemove(option.value);
                    }
                  }}
                  aria-label={`${option.label} entfernen`}
                >
                  <X size={13} />
                </span>
              </span>
            ))
          ) : (
            <span className="property-empty">{emptyLabel}</span>
          )}
        </span>
      </button>
      {open ? (
        <div className="tag-picker-menu">
          <div className="tag-input-row">
            <input
              value={query}
              onChange={(changeEvent) => setQuery(changeEvent.target.value)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" && canCreate && query.trim()) {
                  keyEvent.preventDefault();
                  onCreate?.(query.trim());
                  setQuery("");
                }
              }}
              placeholder={canCreate ? "Techniker auswählen oder erstellen" : "Techniker auswählen"}
            />
          </div>
          <span className="tag-menu-heading">Techniker auswählen</span>
          {filtered.map((option) => (
            <button
              className="tag-option"
              key={option.value}
              type="button"
              onClick={() => {
                onAdd(option.value);
                setOpen(false);
              }}
            >
              <span className="people-chip">
                <PersonAvatar name={option.label} src={option.avatarUrl} />
                {option.label}
              </span>
            </button>
          ))}
          {canCreate && query.trim() ? (
            <button
              className="tag-create-option"
              type="button"
              onClick={() => {
                onCreate?.(query.trim());
                setQuery("");
                setOpen(false);
              }}
            >
              + "{query.trim()}" erstellen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PersonAvatar({ name, src }: { name: string; src?: string }) {
  return (
    <span className="person-avatar" aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseISO(`${value}T12:00:00`));
  const selectedDate = parseISO(`${value}T12:00:00`);
  const days = getCalendarGridDays(viewMonth);
  useCloseOnOutside(pickerRef, () => setOpen(false), open);

  return (
    <div className="date-picker" ref={pickerRef}>
      <button className="tag-picker-trigger" type="button" onClick={() => setOpen((current) => !current)}>
        <span>{format(selectedDate, "dd.MM.yyyy")}</span>
      </button>
      {open ? (
        <div className="date-picker-menu">
          <div className="date-picker-header">
            <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))}>
              ‹
            </button>
            <strong>{monthLabel(viewMonth)}</strong>
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
              ›
            </button>
          </div>
          <div className="date-picker-grid">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {days.map((day) => {
              const dayValue = format(day, "yyyy-MM-dd");
              const selected = dayValue === value;
              return (
                <button
                  className={[
                    selected ? "is-selected" : "",
                    isDayInMonth(day, viewMonth) ? "" : "is-muted"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(dayValue);
                    setOpen(false);
                  }}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SlashRichTextEditor({
  ariaLabel = "Notizen",
  currentUser,
  realtimeKey,
  value,
  onChange,
  placeholder
}: {
  ariaLabel?: string;
  currentUser?: SessionUser | null;
  realtimeKey?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const pageIconPickerRef = useRef<HTMLDivElement>(null);
  const selectedTableRef = useRef<HTMLTableElement | null>(null);
  const selectedCellRef = useRef<HTMLTableCellElement | null>(null);
  const selectedListItemRef = useRef<HTMLLIElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaCommandRef = useRef<SlashCommand | null>(null);
  const selectedFormatRangeRef = useRef<Range | null>(null);
  const applyingRemoteHtmlRef = useRef(false);
  const blockIdsRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());
  const blockElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const clientIdRef = useRef(`client-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const channelReadyRef = useRef(false);
  const liveTypingChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const pendingTypingPayloadRef = useRef<(LiveTypingState & { documentKey: string }) | null>(null);
  const pendingYjsPayloadsRef = useRef<YjsEditorPayload[]>([]);
  const onChangeRef = useRef(onChange);
  const yDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const yDocumentKeyRef = useRef<string | null>(null);
  const yApplyingEditorRef = useRef(false);
  const yReadyRef = useRef(false);
  const ySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yLocalOriginRef = useRef(Symbol("ak-motion-local-editor"));
  const yRemoteOriginRef = useRef(Symbol("ak-motion-remote-editor"));
  const dragBlockIdRef = useRef<string | null>(null);
  const lastLocalEditAtRef = useRef(0);
  const latestEditorHtmlRef = useRef(normalizeNoteHtml(value));
  const liveTypingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [isEmpty, setIsEmpty] = useState(() => !value.trim());
  const [blockHandles, setBlockHandles] = useState<BlockHandle[]>([]);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [activePage, setActivePage] = useState<ActivePage | null>(null);
  const [pageIconPickerOpen, setPageIconPickerOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [tableControls, setTableControls] = useState<TableControlsPosition | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<BlockContextMenu | null>(null);
  const [liveTypers, setLiveTypers] = useState<Record<string, LiveTypingState>>({});
  const [formatToolbar, setFormatToolbar] = useState<{ left: number; top: number } | null>(null);
  useCloseOnOutside(shellRef, () => setSlashOpen(false), slashOpen);
  useCloseOnOutside(pageIconPickerRef, () => setPageIconPickerOpen(false), pageIconPickerOpen);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    function syncFormatToolbar() {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || !selection.rangeCount || selection.isCollapsed || !editor.contains(selection.anchorNode)) {
        setFormatToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        setFormatToolbar(null);
        return;
      }
      selectedFormatRangeRef.current = range;
      setFormatToolbar({ left: Math.max(12, Math.min(window.innerWidth - 430, rect.left + rect.width / 2 - 210)), top: Math.max(12, rect.top - 52) });
    }
    document.addEventListener("selectionchange", syncFormatToolbar);
    window.addEventListener("resize", syncFormatToolbar);
    return () => {
      document.removeEventListener("selectionchange", syncFormatToolbar);
      window.removeEventListener("resize", syncFormatToolbar);
    };
  }, []);

  function formatSelectedText(command: string, value?: string) {
    const editor = editorRef.current;
    const range = selectedFormatRangeRef.current;
    if (!editor || !range) {
      return;
    }
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand(command, false, value);
    syncEditor(false);
    selectedFormatRangeRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : range;
  }

  const commands: SlashCommand[] = [
    { label: "H1", description: "Große Überschrift", html: "<h1><br></h1><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
    { label: "H2", description: "Zwischenüberschrift", html: "<h2><br></h2><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
    { label: "H3", description: "Abschnitt", html: "<h3><br></h3><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
    {
      label: "Aufklappbare Überschrift",
      description: "Toggle mit Inhalt",
      html: "<details open><summary><br></summary><p><br></p></details><p><br></p>",
      keywords: ["toggle", "aufklappen", "überschrift"],
      section: "basis"
    },
    {
      label: "Hinweis",
      description: "Hervorgehobene Infozeile",
      html: '<div class="callout-block"><span>💡</span><p><br></p></div><p><br></p>',
      keywords: ["info", "hinweis", "callout", "hervorhebung"],
      section: "basis"
    },
    { label: "Liste", description: "Aufzählung", html: "<ul><li><br></li></ul><p><br></p>", keywords: ["bullet", "punkt"], section: "basis" },
    {
      label: "Tabelle",
      description: "2 x 2 Tabelle",
      html: "<table><tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>",
      keywords: ["table"],
      section: "basis"
    },
    {
      label: "Neue Seite",
      description: "Leere Seite",
      action: "page",
      keywords: ["page", "seite"],
      section: "basis"
    },
    { label: "Bild", description: "Bilddatei hochladen", action: "image", accept: "image/*", keywords: ["foto", "image"], section: "medien" },
    { label: "Video", description: "Videodatei hochladen", action: "video", accept: "video/*", keywords: ["film"], section: "medien" },
    { label: "Audio", description: "Audiodatei hochladen", action: "audio", accept: "audio/*", keywords: ["sound", "musik"], section: "medien" }
  ];
  const filteredCommands = commands.filter((command) => commandMatchesQuery(command, slashQuery));
  const commandSections = [
    { id: "basis", label: "Basis" },
    { id: "medien", label: "Medien" }
  ] as const;

  function renderCrdtHtml(html: string, preserveCaret: boolean) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const caretOffset = preserveCaret && editor.contains(document.activeElement) ? getCaretTextOffset(editor) : null;
    yApplyingEditorRef.current = true;
    editor.innerHTML = normalizeNoteHtml(html);
    normalizeEditorStructure(editor);
    ensureEditorBlockIds(editor);
    latestEditorHtmlRef.current = sanitizeEditorHtml(editor);
    setIsEmpty(isEditorBlank(editor));
    if (caretOffset !== null) {
      restoreCaretTextOffset(editor, caretOffset);
    }
    requestAnimationFrame(() => {
      refreshBlockHandles(editor);
      updateTableControls();
      yApplyingEditorRef.current = false;
    });
  }

  function applyHtmlToCrdt(html: string) {
    const yText = yTextRef.current;
    if (!yText) {
      return;
    }
    replaceYTextValue(yText, html, yLocalOriginRef.current);
  }

  function sendYjsPayload(payload: YjsEditorPayload) {
    if (!channelReadyRef.current || !liveTypingChannelRef.current) {
      pendingYjsPayloadsRef.current.push(payload);
      return;
    }

    void liveTypingChannelRef.current.send({
      type: "broadcast",
      event: "yjs-update",
      payload
    });
  }

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    setSelectedCommandIndex((current) => Math.min(current, Math.max(filteredCommands.length - 1, 0)));
  }, [filteredCommands.length]);

  useEffect(() => {
    function cleanupDrag() {
      dragBlockIdRef.current = null;
      setDraggingBlockId(null);
      setDropIndicator(null);
    }

    window.addEventListener("dragend", cleanupDrag);
    window.addEventListener("drop", cleanupDrag);
    return () => {
      window.removeEventListener("dragend", cleanupDrag);
      window.removeEventListener("drop", cleanupDrag);
    };
  }, []);

  useEffect(() => {
    if (!blockContextMenu) {
      return;
    }

    function closeMenu() {
      setBlockContextMenu(null);
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [blockContextMenu]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextHtml = normalizeNoteHtml(value);
    const yText = yTextRef.current;
    if (yText && yDocumentKeyRef.current === realtimeKey) {
      const crdtHtml = yReadyRef.current ? yText.toString() : yText.toString() || nextHtml;
      if (!editor.contains(document.activeElement) && editor.innerHTML !== crdtHtml) {
        renderCrdtHtml(crdtHtml, false);
      } else {
        refreshBlockHandles(editor);
      }
      return;
    }

    if (editor.contains(document.activeElement) && latestEditorHtmlRef.current !== nextHtml) {
      refreshBlockHandles(editor);
      return;
    }

    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
    normalizeEditorStructure(editor);
    ensureEditorBlockIds(editor);
    latestEditorHtmlRef.current = sanitizeEditorHtml(editor);
    setIsEmpty(isEditorBlank(editor));
    refreshBlockHandles(editor);
  }, [value]);

  useEffect(() => {
    if (!realtimeKey || !hasSupabaseConfig || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    const yDoc = new Y.Doc();
    const yText = yDoc.getText("html");
    let cancelled = false;

    yDocRef.current = yDoc;
    yTextRef.current = yText;
    yDocumentKeyRef.current = realtimeKey;
    yReadyRef.current = false;

    const persistCrdtState = () => {
      if (ySaveTimerRef.current) {
        clearTimeout(ySaveTimerRef.current);
      }
      ySaveTimerRef.current = setTimeout(() => {
        const currentDoc = yDocRef.current;
        const currentKey = yDocumentKeyRef.current;
        if (!currentDoc || !currentKey || currentKey !== realtimeKey) {
          return;
        }
        void saveEditorCrdtState(currentKey, uint8ArrayToBase64(Y.encodeStateAsUpdate(currentDoc)));
      }, 650);
    };

    const observeText = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (!yReadyRef.current || transaction.origin === yLocalOriginRef.current) {
        return;
      }

      const nextHtml = yText.toString();
      renderCrdtHtml(nextHtml, true);
      onChangeRef.current(nextHtml);
    };

    const sendUpdate = (update: Uint8Array, origin: unknown) => {
      if (!yReadyRef.current) {
        return;
      }

      persistCrdtState();
      if (origin === yRemoteOriginRef.current) {
        return;
      }

      sendYjsPayload({
        clientId: clientIdRef.current,
        documentKey: realtimeKey,
        update: uint8ArrayToBase64(update)
      });
    };

    yText.observe(observeText);
    yDoc.on("update", sendUpdate);

    void loadEditorCrdtState(realtimeKey).then((storedState) => {
      if (cancelled) {
        return;
      }

      if (storedState) {
        Y.applyUpdate(yDoc, base64ToUint8Array(storedState), yRemoteOriginRef.current);
      }

      if (!storedState && !yText.length) {
        const initialHtml = normalizeNoteHtml(value);
        if (initialHtml) {
          replaceYTextValue(yText, initialHtml, yRemoteOriginRef.current);
          void saveEditorCrdtState(realtimeKey, uint8ArrayToBase64(Y.encodeStateAsUpdate(yDoc)));
        }
      }

      yReadyRef.current = true;
      renderCrdtHtml(yText.toString(), false);
    });

    const channel = supabaseClient
      .channel(`ak-motion-editor-${realtimeKey}`)
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        const yPayload = payload as YjsEditorPayload;
        if (!yPayload || yPayload.clientId === clientIdRef.current || yPayload.documentKey !== realtimeKey || !yPayload.update) {
          return;
        }

        try {
          Y.applyUpdate(yDoc, base64ToUint8Array(yPayload.update), yRemoteOriginRef.current);
        } catch (error) {
          console.error("Yjs-Update konnte nicht angewendet werden:", error);
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as LiveTypingState & { documentKey?: string };
        if (!typing || typing.clientId === clientIdRef.current || typing.documentKey !== realtimeKey) {
          return;
        }

        const editor = editorRef.current;
        if (editor) {
          refreshBlockHandles(editor);
        }

        if (liveTypingTimersRef.current.has(typing.clientId)) {
          clearTimeout(liveTypingTimersRef.current.get(typing.clientId));
        }
        setLiveTypers((current) => ({ ...current, [typing.clientId]: typing }));
        liveTypingTimersRef.current.set(
          typing.clientId,
          setTimeout(() => {
            setLiveTypers((current) => {
              const next = { ...current };
              delete next[typing.clientId];
              return next;
            });
            liveTypingTimersRef.current.delete(typing.clientId);
          }, 1800)
        );
      })
      .subscribe((status) => {
        channelReadyRef.current = status === "SUBSCRIBED";
        if (channelReadyRef.current && pendingTypingPayloadRef.current) {
          void channel.send({
            type: "broadcast",
            event: "typing",
            payload: pendingTypingPayloadRef.current
          });
          pendingTypingPayloadRef.current = null;
        }
        if (channelReadyRef.current && pendingYjsPayloadsRef.current.length) {
          const payloads = pendingYjsPayloadsRef.current;
          pendingYjsPayloadsRef.current = [];
          payloads.forEach((payload) => sendYjsPayload(payload));
        }
      });
    liveTypingChannelRef.current = channel;

    return () => {
      cancelled = true;
      yText.unobserve(observeText);
      yDoc.off("update", sendUpdate);
      if (ySaveTimerRef.current) {
        clearTimeout(ySaveTimerRef.current);
        ySaveTimerRef.current = null;
        void saveEditorCrdtState(realtimeKey, uint8ArrayToBase64(Y.encodeStateAsUpdate(yDoc)));
      }
      yDoc.destroy();
      liveTypingTimersRef.current.forEach((timer) => clearTimeout(timer));
      liveTypingTimersRef.current.clear();
      setLiveTypers({});
      channelReadyRef.current = false;
      yReadyRef.current = false;
      yDocRef.current = null;
      yTextRef.current = null;
      yDocumentKeyRef.current = null;
      liveTypingChannelRef.current = null;
      pendingTypingPayloadRef.current = null;
      pendingYjsPayloadsRef.current = [];
      void supabaseClient.removeChannel(channel);
    };
  }, [realtimeKey]);

  function syncEditor(openSlashMenu = true) {
    const editor = editorRef.current;
    if (!editor || applyingRemoteHtmlRef.current || yApplyingEditorRef.current) {
      return;
    }

    const blank = isEditorBlank(editor);
    normalizeEditorStructure(editor, true);
    ensureEditorBlockIds(editor);
    const nextHtml = blank ? "" : sanitizeEditorHtml(editor);
    lastLocalEditAtRef.current = Date.now();
    setIsEmpty(blank);
    latestEditorHtmlRef.current = nextHtml;
    applyHtmlToCrdt(nextHtml);
    onChange(nextHtml);
    broadcastTyping(nextHtml);
    const slashState = getSlashState(editor);
    setSlashOpen(openSlashMenu && slashState.active);
    setSlashQuery(slashState.query);
    refreshBlockHandles(editor);
    updateTableControls();
  }

  function forkActiveBlockDuringConcurrentEdit(editor: HTMLElement) {
    if (!Object.keys(liveTypers).length) {
      return;
    }

    const activeBlock = getActiveBlock(editor);
    if (!activeBlock || activeBlock.dataset.clientFork === clientIdRef.current) {
      return;
    }

    const currentId = activeBlock.dataset.liveBlockId;
    if (!currentId || currentId.startsWith(`local-${clientIdRef.current}-`)) {
      return;
    }

    const forkId = `local-${clientIdRef.current}-${currentId}`;
    activeBlock.dataset.liveBlockId = forkId;
    activeBlock.dataset.clientFork = clientIdRef.current;
    activeBlock.dataset.forkedFromBlockId = currentId;
    blockIdsRef.current.set(activeBlock, forkId);
  }

  function insertCommand(command: SlashCommand) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    deleteSlashBeforeCaret(editor);

    if (command.action === "page") {
      insertPageBlock(editor);
    } else if (command.action) {
      pendingMediaCommandRef.current = command;
      if (mediaInputRef.current) {
        mediaInputRef.current.accept = command.accept ?? "";
      }
      mediaInputRef.current?.click();
    } else if (command.html) {
      insertBlockHtmlAtSelection(editor, command.html);
    }

    ensureEditorBlockIds(editor);
    const nextHtml = sanitizeEditorHtml(editor);
    lastLocalEditAtRef.current = Date.now();
    setIsEmpty(isEditorBlank(editor));
    latestEditorHtmlRef.current = nextHtml;
    applyHtmlToCrdt(nextHtml);
    onChange(nextHtml);
    broadcastTyping(nextHtml);
    setSlashOpen(false);
    refreshBlockHandles(editor);
    updateTableControls();
  }

  function handleKeyDown(keyEvent: KeyboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const selectionNode = selection?.anchorNode ?? null;
    const selectionElement =
      selectionNode?.nodeType === Node.ELEMENT_NODE ? (selectionNode as HTMLElement) : selectionNode?.parentElement ?? null;

    const activeListItem = (selectionElement?.closest("li") as HTMLLIElement | null) ?? selectedListItemRef.current;
    const liveSlashState = editor ? getSlashState(editor) : { active: false, query: "" };

    if (slashOpen && keyEvent.key === "ArrowDown") {
      keyEvent.preventDefault();
      setSelectedCommandIndex((current) => (filteredCommands.length ? (current + 1) % filteredCommands.length : 0));
      return;
    }

    if (slashOpen && keyEvent.key === "ArrowUp") {
      keyEvent.preventDefault();
      setSelectedCommandIndex((current) =>
        filteredCommands.length ? (current - 1 + filteredCommands.length) % filteredCommands.length : 0
      );
      return;
    }

    if (keyEvent.key === "Enter" && editor && (slashOpen || liveSlashState.active)) {
      const liveCommands = commands.filter((command) => commandMatchesQuery(command, liveSlashState.query || slashQuery));
      const command = liveCommands[selectedCommandIndex] ?? liveCommands[0];
      if (!command) {
        return;
      }

      keyEvent.preventDefault();
      insertCommand(command);
      return;
    }

    if (keyEvent.key === "Tab" && editor && activeListItem && editor.contains(activeListItem)) {
      keyEvent.preventDefault();
      indentListItem(activeListItem, keyEvent.shiftKey ? "out" : "in");
      syncEditor(false);
      return;
    }

    if (keyEvent.key === "Escape") {
      setSlashOpen(false);
      setSlashQuery("");
    }
  }

  async function handleMediaSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    const command = pendingMediaCommandRef.current;
    pendingMediaCommandRef.current = null;

    if (!file || !command?.action) {
      return;
    }

    const editor = editorRef.current;
    try {
      const source = await uploadAppMedia(file, "editor");
      if (!editor || !source) {
        return;
      }

      const html = mediaFileToHtml(command.action!, source, file.name);
      insertBlockHtmlAtSelection(editor, html);
      ensureEditorBlockIds(editor);
      const nextHtml = sanitizeEditorHtml(editor);
      lastLocalEditAtRef.current = Date.now();
      latestEditorHtmlRef.current = nextHtml;
      applyHtmlToCrdt(nextHtml);
      onChange(nextHtml);
      broadcastTyping(nextHtml);
      setIsEmpty(isEditorBlank(editor));
      refreshBlockHandles(editor);
    } catch (error) {
      console.error("Medium konnte nicht hochgeladen werden:", error);
      window.alert(error instanceof Error ? error.message : "Medium konnte nicht hochgeladen werden.");
    }
  }

  function handleEditorClick(mouseEvent: ReactMouseEvent<HTMLDivElement>) {
    const target = mouseEvent.target as HTMLElement;
    const pageLink = target.closest(".notion-page-link") as HTMLElement | null;
    if (pageLink && editorRef.current?.contains(pageLink)) {
      setActivePage(readPageFromElement(pageLink));
      setPageIconPickerOpen(false);
      return;
    }

    const listItem = target.closest("li") as HTMLLIElement | null;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    const table = target.closest("table") as HTMLTableElement | null;
    selectedListItemRef.current = listItem && editorRef.current?.contains(listItem) ? listItem : null;

    if (table && editorRef.current?.contains(table)) {
      selectedTableRef.current = table;
      selectedCellRef.current = cell;
      positionTableControls(table);
      return;
    }

    selectedTableRef.current = null;
    selectedCellRef.current = null;
    setTableControls(null);
  }

  function handleEditorMouseMove(mouseEvent: ReactMouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const target = mouseEvent.target as HTMLElement;
    const block = target.closest("p, div, h1, h2, h3, details, ul, ol, table, figure, .notion-page-link, li") as HTMLElement | null;
    const table = target.closest("table") as HTMLTableElement | null;

    if (table && editor?.contains(table)) {
      selectedTableRef.current = table;
      positionTableControls(table);
    }

    if (!editor || !block || !editor.contains(block)) {
      setHoveredBlockId(null);
      return;
    }

    const handleBlock = (block.closest(".notion-page-link") as HTMLElement | null) ?? (block.closest("li") as HTMLElement | null) ?? block;

    setHoveredBlockId(getBlockId(handleBlock));
  }

  function addTableRow() {
    const table = getSelectedTable();
    if (!table) {
      return;
    }

    const referenceRow = selectedCellRef.current?.parentElement as HTMLTableRowElement | null;
    const row = referenceRow ?? table.rows[table.rows.length - 1];
    const cellCount = Math.max(row?.cells.length ?? 0, table.rows[0]?.cells.length ?? 2);
    const newRow = document.createElement("tr");

    for (let index = 0; index < cellCount; index += 1) {
      const cell = document.createElement("td");
      cell.innerHTML = "&nbsp;";
      newRow.append(cell);
    }

    if (row) {
      row.after(newRow);
    } else {
      table.append(newRow);
    }

    selectedCellRef.current = newRow.cells[0] ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function appendTableRow() {
    const table = getSelectedTable();
    if (!table) {
      return;
    }

    const referenceRow = table.rows[table.rows.length - 1];
    const cellCount = Math.max(referenceRow?.cells.length ?? 0, table.rows[0]?.cells.length ?? 2);
    const newRow = document.createElement("tr");

    for (let index = 0; index < cellCount; index += 1) {
      const cell = document.createElement("td");
      cell.innerHTML = "&nbsp;";
      newRow.append(cell);
    }

    if (table.tBodies[0]) {
      table.tBodies[0].append(newRow);
    } else {
      table.append(newRow);
    }
    selectedCellRef.current = newRow.cells[0] ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function addTableColumn() {
    const table = getSelectedTable();
    if (!table) {
      return;
    }

    const referenceIndex = selectedCellRef.current?.cellIndex ?? Math.max((table.rows[0]?.cells.length ?? 1) - 1, 0);

    Array.from(table.rows).forEach((row, rowIndex) => {
      const cell = document.createElement(rowIndex === 0 ? "th" : "td");
      cell.innerHTML = rowIndex === 0 ? "Spalte" : "&nbsp;";
      row.insertBefore(cell, row.cells[referenceIndex + 1] ?? null);
    });

    selectedCellRef.current = table.rows[0]?.cells[referenceIndex + 1] ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function appendTableColumn() {
    const table = getSelectedTable();
    if (!table) {
      return;
    }

    Array.from(table.rows).forEach((row) => {
      const cell = document.createElement("td");
      cell.innerHTML = "&nbsp;";
      row.append(cell);
    });

    selectedCellRef.current = table.rows[0]?.cells[table.rows[0].cells.length - 1] ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function removeTableRow() {
    const table = getSelectedTable();
    if (!table || table.rows.length <= 1) {
      return;
    }

    const referenceRow = (selectedCellRef.current?.parentElement as HTMLTableRowElement | null) ?? table.rows[table.rows.length - 1];
    const nextSelection = referenceRow.previousElementSibling ?? referenceRow.nextElementSibling;
    referenceRow.remove();
    selectedCellRef.current = (nextSelection?.querySelector("td, th") as HTMLTableCellElement | null) ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function removeTableColumn() {
    const table = getSelectedTable();
    const columnCount = table?.rows[0]?.cells.length ?? 0;
    if (!table || columnCount <= 1) {
      return;
    }

    const referenceIndex = selectedCellRef.current?.cellIndex ?? columnCount - 1;
    Array.from(table.rows).forEach((row) => {
      row.cells[referenceIndex]?.remove();
    });

    const nextIndex = Math.min(referenceIndex, (table.rows[0]?.cells.length ?? 1) - 1);
    selectedCellRef.current = table.rows[0]?.cells[nextIndex] ?? null;
    syncEditor(false);
    positionTableControls(table);
  }

  function getSelectedTable() {
    if (selectedTableRef.current && editorRef.current?.contains(selectedTableRef.current)) {
      return selectedTableRef.current;
    }

    const fallback = editorRef.current?.querySelector("table") ?? null;
    selectedTableRef.current = fallback;
    return fallback;
  }

  function insertPageBlock(editor: HTMLElement) {
    const id = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const title = "Neue Seite";
    const icon = "📄";
    const page = createPageLinkElement({ content: "", icon, id, title });

    insertBlockNodeAtSelection(editor, page);
    setActivePage({ content: "", element: page, icon, id, title });
    setPageIconPickerOpen(false);
  }

  function updateActivePageTitle(title: string) {
    setActivePage((current) => {
      if (!current) {
        return current;
      }

      const nextTitle = title || "Unbenannte Seite";
      current.element.dataset.pageTitle = nextTitle;
      current.element.querySelector("strong")!.textContent = nextTitle;
      syncEditor(false);
      return { ...current, title };
    });
  }

  function updateActivePageIcon(icon: string) {
    setActivePage((current) => {
      if (!current) {
        return current;
      }

      const nextIcon = Array.from(icon.trim()).slice(0, 2).join("") || "📄";
      current.element.dataset.pageIcon = nextIcon;
      const glyph = current.element.querySelector(".notion-page-glyph");
      if (glyph) {
        glyph.textContent = nextIcon;
      }
      syncEditor(false);
      return { ...current, icon: nextIcon };
    });
  }

  function updateActivePageContent(content: string) {
    setActivePage((current) => {
      if (!current) {
        return current;
      }

      current.element.dataset.pageContent = encodePageContent(content);
      syncEditor(false);
      return { ...current, content };
    });
  }

  function getBlockId(element: HTMLElement) {
    const existingAttribute = element.dataset.liveBlockId;
    if (existingAttribute) {
      blockIdsRef.current.set(element, existingAttribute);
      return existingAttribute;
    }

    const existing = blockIdsRef.current.get(element);
    if (existing) {
      element.dataset.liveBlockId = existing;
      return existing;
    }

    const id = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    blockIdsRef.current.set(element, id);
    element.dataset.liveBlockId = id;
    return id;
  }

  function refreshBlockHandles(editor: HTMLElement | null = editorRef.current) {
    const shell = shellRef.current;
    if (!editor || !shell) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const blockMap = new Map<string, HTMLElement>();
    ensureEditorBlockIds(editor);
    const blocks = getEditorHandleBlocks(editor);

    const nextHandles = blocks
      .map((block) => {
        const rect = block.getBoundingClientRect();
        const id = getBlockId(block);
        blockMap.set(id, block);
        return {
          id,
          top: rect.top - shellRect.top,
          height: rect.height,
          authorName: undefined,
          authorAvatar: undefined
        };
      })
      .filter((handle) => handle.height > 0);

    blockElementsRef.current = blockMap;
    setBlockHandles(nextHandles);
  }

  function moveBlock(sourceId: string, targetId: string) {
    moveBlockTo(sourceId, targetId, "before");
  }

  function moveBlockTo(sourceId: string, targetId: string, placement: "before" | "after") {
    const source = blockElementsRef.current.get(sourceId);
    const target = blockElementsRef.current.get(targetId);
    const editor = editorRef.current;

    if (!source || !target || source === target || !editor || source.parentElement !== target.parentElement) {
      return;
    }

    if (placement === "after") {
      target.after(source);
    } else {
      target.before(source);
    }

    syncEditor(false);
  }

  function deleteBlock(blockId: string) {
    const block = blockElementsRef.current.get(blockId);
    if (!block || !editorRef.current?.contains(block)) {
      setBlockContextMenu(null);
      return;
    }

    block.remove();
    setBlockContextMenu(null);
    syncEditor(false);
  }

  function getDropIndicator(clientY: number): DropIndicator | null {
    const shell = shellRef.current;
    if (!shell || !blockHandles.length) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const relativeY = clientY - shellRect.top;
    const closest = blockHandles.reduce((best, handle) => {
      const midpoint = handle.top + handle.height / 2;
      const distance = Math.abs(relativeY - midpoint);
      return distance < best.distance ? { distance, handle } : best;
    }, { distance: Number.POSITIVE_INFINITY, handle: blockHandles[0] });

    const placement = relativeY > closest.handle.top + closest.handle.height / 2 ? "after" : "before";
    return {
      placement,
      targetId: closest.handle.id,
      top: placement === "after" ? closest.handle.top + closest.handle.height : closest.handle.top
    };
  }

  function handleEditorDragOver(dragEvent: DragEvent<HTMLDivElement>) {
    if (!dragBlockIdRef.current) {
      return;
    }

    dragEvent.preventDefault();
    dragEvent.dataTransfer.dropEffect = "move";
    setDropIndicator(getDropIndicator(dragEvent.clientY));
  }

  function handleEditorDrop(dragEvent: DragEvent<HTMLDivElement>) {
    if (!dragBlockIdRef.current) {
      return;
    }

    dragEvent.preventDefault();
    dragEvent.stopPropagation();
    const indicator = dropIndicator ?? getDropIndicator(dragEvent.clientY);
    const sourceId = dragBlockIdRef.current;
    dragBlockIdRef.current = null;
    setDraggingBlockId(null);
    setDropIndicator(null);

    if (indicator) {
      moveBlockTo(sourceId, indicator.targetId, indicator.placement);
    }
  }

  function handleBlockDragStart(blockId: string, dragEvent: DragEvent<HTMLButtonElement>) {
    dragEvent.stopPropagation();
    dragBlockIdRef.current = blockId;
    setDraggingBlockId(blockId);
    setBlockContextMenu(null);
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("application/x-ak-motion-block", blockId);
    dragEvent.dataTransfer.setData("text/plain", "");
  }

  function handleBlockDrop(targetId: string, dragEvent: DragEvent<HTMLButtonElement>) {
    dragEvent.preventDefault();
    const sourceId = dragBlockIdRef.current ?? dragEvent.dataTransfer.getData("application/x-ak-motion-block");
    dragBlockIdRef.current = null;
    setDraggingBlockId(null);
    setDropIndicator(null);
    if (sourceId) {
      moveBlock(sourceId, targetId);
    }
  }

  function positionTableControls(table: HTMLTableElement) {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const tableRect = table.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    setTableControls({
      top: tableRect.top - shellRect.top,
      left: tableRect.left - shellRect.left,
      width: tableRect.width,
      height: tableRect.height
    });
  }

  function updateTableControls() {
    const table = selectedTableRef.current;
    if (table && editorRef.current?.contains(table)) {
      positionTableControls(table);
    } else {
      setTableControls(null);
    }
  }

  function broadcastTyping(html: string) {
    if (!realtimeKey || !currentUser || !hasSupabaseConfig || !supabase) {
      return;
    }

    const activeBlock = getActiveBlock(editorRef.current);
    const blockId = activeBlock ? getBlockId(activeBlock) : "";
    const payload = {
      avatarUrl: currentUser.avatarUrl,
      blockHtml: activeBlock?.outerHTML ?? "",
      blockId,
      caretTop: activeBlock ? getCaretTopWithinBlock(activeBlock) : undefined,
      clientId: clientIdRef.current,
      documentKey: realtimeKey,
      html,
      name: currentUser.name
    };

    if (!channelReadyRef.current || !liveTypingChannelRef.current) {
      pendingTypingPayloadRef.current = payload;
      return;
    }

    void liveTypingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload
    });
  }

  const liveTypingBadges = Object.values(liveTypers)
    .map((typing) => {
      return {
        typing,
        handle: blockHandles.find((handle) => handle.id === typing.blockId)
      };
    })
    .filter((item): item is { typing: LiveTypingState; handle: BlockHandle } => Boolean(item.handle));

  return (
    <div className="slash-editor" ref={shellRef}>
      {formatToolbar ? (
        <div className="rich-format-toolbar" style={{ left: formatToolbar.left, top: formatToolbar.top }}>
          <button type="button" aria-label="Fett" title="Fett" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText("bold")}><Bold size={15} /></button>
          <button type="button" aria-label="Kursiv" title="Kursiv" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText("italic")}><Italic size={15} /></button>
          <button type="button" aria-label="Durchgestrichen" title="Durchgestrichen" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText("strikeThrough")}><Strikethrough size={15} /></button>
          <label title="Schriftart">
            <Type size={14} />
            <select aria-label="Schriftart" defaultValue="Inter" onChange={(event) => formatSelectedText("fontName", event.target.value)}>
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Mono</option>
            </select>
          </label>
          <select aria-label="Schriftgröße" title="Schriftgröße" defaultValue="3" onChange={(event) => formatSelectedText("fontSize", event.target.value)}>
            <option value="2">Klein</option>
            <option value="3">Normal</option>
            <option value="4">Groß</option>
            <option value="5">Sehr groß</option>
          </select>
          <label className="rich-color-control" title="Textfarbe">
            <span aria-hidden="true" />
            <input type="color" aria-label="Textfarbe" defaultValue="#f2f2f2" onChange={(event) => formatSelectedText("foreColor", event.target.value)} />
          </label>
        </div>
      ) : null}
      <div className="block-handle-layer" aria-hidden="true">
        {liveTypingBadges.map(({ typing, handle }) => {
          return (
            <span
              className="block-author-avatar is-live"
              key={typing.clientId}
              style={{ top: handle.top + Math.min(Math.max(typing.caretTop ?? Math.max(0, handle.height - 26) / 2, 0), Math.max(0, handle.height - 26)) }}
              title={`${typing.name} tippt gerade`}
            >
              {typing.avatarUrl ? <img src={typing.avatarUrl} alt="" /> : initials(typing.name)}
            </span>
          );
        })}
        {blockHandles.map((handle) => (
          <Fragment key={handle.id}>
            <button
              className={[
                "block-handle",
                handle.id === hoveredBlockId || draggingBlockId ? "is-visible" : "",
                handle.id === draggingBlockId ? "is-dragging" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              draggable
              style={{ top: handle.top + Math.max(0, handle.height - 26) / 2 }}
              onDragStart={(dragEvent) => handleBlockDragStart(handle.id, dragEvent)}
              onDragEnd={() => {
                dragBlockIdRef.current = null;
                setDraggingBlockId(null);
              }}
              onDragOver={(dragEvent) => dragEvent.preventDefault()}
              onDrop={(dragEvent) => handleBlockDrop(handle.id, dragEvent)}
              onContextMenu={(mouseEvent) => {
                mouseEvent.preventDefault();
                mouseEvent.stopPropagation();
                setBlockContextMenu({ blockId: handle.id, x: mouseEvent.clientX, y: mouseEvent.clientY });
              }}
              onMouseEnter={() => setHoveredBlockId(handle.id)}
              tabIndex={-1}
            >
              ⋮⋮
            </button>
          </Fragment>
        ))}
      </div>
      {blockContextMenu ? (
        <div
          className="block-context-menu"
          style={{ left: blockContextMenu.x, top: blockContextMenu.y }}
          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
        >
          <button type="button" onClick={() => deleteBlock(blockContextMenu.blockId)}>
            Löschen
          </button>
        </div>
      ) : null}
      {dropIndicator ? <div className="block-drop-indicator" style={{ top: dropIndicator.top }} /> : null}
      {tableControls ? (
        <div
          className="table-controls"
          style={{ top: tableControls.top, left: tableControls.left, width: tableControls.width, height: tableControls.height }}
        >
          <button
            className="table-add-column"
            type="button"
            aria-label="Spalte hinzufügen"
            onMouseDown={(mouseEvent) => {
              mouseEvent.preventDefault();
              appendTableColumn();
            }}
          >
            +
          </button>
          <button
            className="table-remove-column"
            type="button"
            aria-label="Spalte löschen"
            onMouseDown={(mouseEvent) => {
              mouseEvent.preventDefault();
              removeTableColumn();
            }}
          >
            -
          </button>
          <button
            className="table-add-row"
            type="button"
            aria-label="Zeile hinzufügen"
            onMouseDown={(mouseEvent) => {
              mouseEvent.preventDefault();
              appendTableRow();
            }}
          >
            +
          </button>
          <button
            className="table-remove-row"
            type="button"
            aria-label="Zeile löschen"
            onMouseDown={(mouseEvent) => {
              mouseEvent.preventDefault();
              removeTableRow();
            }}
          >
            -
          </button>
        </div>
      ) : null}
      <div
        ref={editorRef}
        className={isEmpty ? "rich-text-editor is-empty" : "rich-text-editor"}
        contentEditable
        data-placeholder={placeholder}
        onInput={() => syncEditor()}
        onClick={handleEditorClick}
        onDragEnter={handleEditorDragOver}
        onDragOver={handleEditorDragOver}
        onDrop={handleEditorDrop}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHoveredBlockId(null)}
        onMouseMove={handleEditorMouseMove}
        onPaste={(pasteEvent) => {
          pasteEvent.preventDefault();
          const text = pasteEvent.clipboardData.getData("text/plain");
          insertHtmlAtSelection(pasteEvent.currentTarget, textToHtml(text));
          syncEditor(false);
        }}
        role="textbox"
        aria-label={ariaLabel}
        suppressContentEditableWarning
      />
      {slashOpen ? (
        <div className="slash-menu">
          <span>{slashQuery ? `/${slashQuery}` : "Block hinzufügen"}</span>
          {commandSections.map((section) => {
            const sectionCommands = filteredCommands.filter((command) => command.section === section.id);
            if (!sectionCommands.length) {
              return null;
            }

            return (
              <div className="slash-menu-section" key={section.id}>
                <em>{section.label}</em>
                {sectionCommands.map((command) => {
                  const commandIndex = filteredCommands.indexOf(command);
                  return (
                    <button
                      className={commandIndex === selectedCommandIndex ? "is-selected" : ""}
                      key={command.label}
                      type="button"
                      onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
                      onMouseEnter={() => setSelectedCommandIndex(commandIndex)}
                      onClick={() => insertCommand(command)}
                    >
                      <strong>{command.label}</strong>
                      <small>{command.description}</small>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
      <input
        ref={mediaInputRef}
        className="visually-hidden"
        type="file"
        accept={pendingMediaCommandRef.current?.accept}
        onChange={(changeEvent) => {
          handleMediaSelected(changeEvent.target.files);
          changeEvent.target.value = "";
        }}
      />
      {activePage ? (
        <div className="notion-page-view">
          <button className="page-back-button" type="button" onClick={() => setActivePage(null)}>
            <ArrowLeft size={18} />
            Zurück
          </button>
          <div className="notion-page-view-inner">
            <div className="notion-page-icon-picker" ref={pageIconPickerRef}>
              <button
                className="notion-page-icon-button"
                type="button"
                onClick={() => setPageIconPickerOpen((current) => !current)}
                aria-expanded={pageIconPickerOpen}
                aria-label="Seitenicon"
              >
                {activePage.icon}
              </button>
              {pageIconPickerOpen ? (
                <div className="notion-page-icon-menu">
                  {pageIconOptions.map((icon) => (
                    <button
                      className={icon === activePage.icon ? "is-selected" : ""}
                      key={icon}
                      type="button"
                      onClick={() => {
                        updateActivePageIcon(icon);
                        setPageIconPickerOpen(false);
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              className="notion-page-title-input"
              value={activePage.title}
              onChange={(changeEvent) => updateActivePageTitle(changeEvent.target.value)}
              aria-label="Seitentitel"
              placeholder="Neue Seite"
            />
            <SlashRichTextEditor
              ariaLabel={`Inhalt von ${activePage.title || "Seite"}`}
              value={activePage.content}
              onChange={updateActivePageContent}
              placeholder="Schreibe etwas oder tippe / für Befehle..."
              currentUser={currentUser}
              realtimeKey={`${realtimeKey ?? "editor"}-page-${activePage.id}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (timePattern.test(trimmed)) {
    return trimmed;
  }

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const normalized = `${colonMatch[1].padStart(2, "0")}:${colonMatch[2]}`;
    return timePattern.test(normalized) ? normalized : null;
  }

  const compactMatch = trimmed.match(/^(\d{1,2})(\d{2})$/);
  if (compactMatch) {
    const normalized = `${compactMatch[1].padStart(2, "0")}:${compactMatch[2]}`;
    return timePattern.test(normalized) ? normalized : null;
  }

  return null;
}

function normalizeNoteHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/<(p|br|h1|h2|h3|details|summary|ul|ol|li|table|tbody|tr|th|td|strong|em|div|figure|figcaption|img|video|audio|source)\b/i.test(trimmed)) {
    return trimmed;
  }

  return textToHtml(decodeTextLikeHtml(value));
}

function decodeTextLikeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function textToHtml(value: string) {
  const lines = value.split(/\r?\n/);
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push("<p><br></p>");
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const headerCells = markdownTableCells(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(markdownTableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push(markdownTableToHtml(headerCells, rows));
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(`<li>${escapeHtml(lines[index].trim().slice(2))}</li>`);
        index += 1;
      }
      index -= 1;
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  return blocks.join("");
}

function isMarkdownTableStart(lines: string[], index: number) {
  return Boolean(lines[index]?.includes("|") && lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/));
}

function markdownTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function markdownTableToHtml(headerCells: string[], rows: string[][]) {
  const header = headerCells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><tbody><tr>${header}</tr>${body}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isEditorBlank(editor: HTMLElement) {
  return editor.textContent?.trim() === "" && editor.querySelector("table") === null;
}

function getSlashState(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) {
    return { active: false, query: "" };
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) {
    return { active: false, query: "" };
  }

  const before = range.cloneRange();
  before.selectNodeContents(editor);
  before.setEnd(range.endContainer, range.endOffset);
  const match = before.toString().replace(/\s+$/, "").match(/\/([^\s/]*)$/);
  return match ? { active: true, query: match[1] } : { active: false, query: "" };
}

function sanitizeEditorHtml(editor: HTMLElement) {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[data-remote-shadow='true']").forEach((element) => element.remove());
  clone.querySelectorAll<HTMLElement>("[data-author-id], [data-author-name], [data-author-avatar]").forEach((element) => {
    delete element.dataset.authorId;
    delete element.dataset.authorName;
    delete element.dataset.authorAvatar;
  });
  clone.querySelectorAll<HTMLElement>("[data-remote-client-id], [data-remote-source-block-id], [data-forked-from-block-id], [data-client-fork]").forEach((element) => {
    delete element.dataset.remoteClientId;
    delete element.dataset.remoteSourceBlockId;
    delete element.dataset.forkedFromBlockId;
    delete element.dataset.clientFork;
  });
  return clone.innerHTML;
}

function getActiveBlock(editor: HTMLElement | null) {
  if (!editor) {
    return null;
  }

  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode ?? null;
  if (!anchorNode || !editor.contains(anchorNode)) {
    return null;
  }

  return closestEditorHandleBlock(anchorNode, editor);
}

function closestEditorHandleBlock(node: Node, editor: HTMLElement) {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

  while (current && current !== editor) {
    const pageLink = current.closest(".notion-page-link") as HTMLElement | null;
    if (pageLink && editor.contains(pageLink)) {
      return pageLink;
    }

    if (current.tagName === "LI") {
      return current;
    }

    if (current.matches("p, div, h1, h2, h3, details, ul, ol, table, figure")) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getEditorHandleBlocks(editor: HTMLElement) {
  return Array.from(
    editor.querySelectorAll<HTMLElement>(
      ":scope > p, :scope > div:not(.notion-page-link), :scope > h1, :scope > h2, :scope > h3, :scope > details, :scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > .notion-page-link, li"
    )
  ).filter((block) => !block.closest(".notion-page-link") || block.classList.contains("notion-page-link"));
}

function normalizeEditorStructure(editor: HTMLElement, preserveCaret = false) {
  const directTextNodes = Array.from(editor.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").length > 0
  );
  if (!directTextNodes.length) {
    return;
  }

  const caretOffset = preserveCaret ? getCaretTextOffset(editor) : null;
  directTextNodes.forEach((node) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = (node.textContent ?? "").replace(/\u00a0/g, " ");
    node.replaceWith(paragraph);
  });
  ensureEditorBlockIds(editor);
  if (caretOffset !== null) {
    restoreCaretTextOffset(editor, caretOffset);
  }
}

function ensureEditorBlockIds(editor: HTMLElement) {
  getEditorHandleBlocks(editor).forEach((block) => {
    if (!block.dataset.liveBlockId) {
      block.dataset.liveBlockId = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  });
}

function htmlToBlockElement(blockHtml: string) {
  const template = document.createElement("template");
  template.innerHTML = blockHtml.trim();
  return template.content.firstElementChild as HTMLElement | null;
}

function findBlockByLiveId(editor: HTMLElement, blockId: string) {
  return getEditorHandleBlocks(editor).find((block) => block.dataset.liveBlockId === blockId) ?? null;
}

function mergeActiveBlockText(localBlock: HTMLElement, remoteBlockHtml: string) {
  const remoteBlock = htmlToBlockElement(remoteBlockHtml);
  if (!remoteBlock) {
    return;
  }

  const localText = localBlock.textContent ?? "";
  const remoteText = remoteBlock.textContent ?? "";
  if (!remoteText || localText === remoteText || localText.includes(remoteText)) {
    return;
  }

  const caretOffset = getCaretTextOffset(localBlock);
  const mergedText = mergeConcurrentText(localText, remoteText);
  if (mergedText === localText) {
    return;
  }

  replaceBlockText(localBlock, mergedText);
  restoreCaretTextOffset(localBlock, Math.min(mergedText.length, caretOffset + Math.max(0, mergedText.length - localText.length)));
}

function mergeConcurrentText(localText: string, remoteText: string) {
  if (!localText) {
    return remoteText;
  }
  if (!remoteText || localText === remoteText || localText.includes(remoteText)) {
    return localText;
  }
  if (remoteText.includes(localText)) {
    return remoteText;
  }

  let prefixLength = 0;
  while (
    prefixLength < localText.length &&
    prefixLength < remoteText.length &&
    localText[prefixLength] === remoteText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < localText.length - prefixLength &&
    suffixLength < remoteText.length - prefixLength &&
    localText[localText.length - 1 - suffixLength] === remoteText[remoteText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const prefix = localText.slice(0, prefixLength);
  const suffix = suffixLength ? localText.slice(localText.length - suffixLength) : "";
  const localMiddle = localText.slice(prefixLength, suffixLength ? localText.length - suffixLength : localText.length);
  const remoteMiddle = remoteText.slice(prefixLength, suffixLength ? remoteText.length - suffixLength : remoteText.length);
  const middle = localMiddle.includes(remoteMiddle)
    ? localMiddle
    : remoteMiddle.includes(localMiddle)
      ? remoteMiddle
      : `${localMiddle}${remoteMiddle}`;

  return `${prefix}${middle}${suffix}`;
}

function getCaretTextOffset(container: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !container.contains(selection.anchorNode)) {
    return container.textContent?.length ?? 0;
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(container);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}

function getCaretTopWithinBlock(container: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !container.contains(selection.anchorNode)) {
    return Math.max(0, (container.getBoundingClientRect().height - 26) / 2);
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = Array.from(range.getClientRects()).at(-1);
  const blockRect = container.getBoundingClientRect();
  if (!rect || !blockRect.height) {
    return Math.max(0, (blockRect.height - 26) / 2);
  }

  return Math.max(0, rect.top - blockRect.top + Math.max(0, rect.height - 26) / 2);
}

function replaceBlockText(block: HTMLElement, text: string) {
  if (block.matches("table, figure, .notion-page-link")) {
    return;
  }

  if (block.matches("ul, ol")) {
    const item = block.querySelector("li");
    if (item) {
      item.textContent = text;
    }
    return;
  }

  if (block.matches("details")) {
    const summary = block.querySelector("summary");
    if (summary) {
      summary.textContent = text;
    }
    return;
  }

  if (block.classList.contains("callout-block")) {
    const paragraph = block.querySelector("p") ?? block;
    paragraph.textContent = text;
    return;
  }

  block.textContent = text;
}

function restoreCaretTextOffset(container: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let remaining = offset;
  const range = document.createRange();

  while (current) {
    const length = current.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(current, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    current = walker.nextNode();
  }

  range.selectNodeContents(container);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function mergeRemoteDocumentHtml(editor: HTMLElement, remoteHtml: string) {
  if (!remoteHtml.includes("data-live-block-id")) {
    return;
  }

  const activeBlockId = getActiveBlock(editor)?.dataset.liveBlockId;
  const remoteEditor = document.createElement("div");
  remoteEditor.innerHTML = normalizeNoteHtml(remoteHtml);
  const remoteBlocks = getEditorHandleBlocks(remoteEditor).filter((block) => block.dataset.liveBlockId);

  remoteBlocks.forEach((remoteBlock, index) => {
    const blockId = remoteBlock.dataset.liveBlockId;
    if (!blockId || blockId === activeBlockId) {
      return;
    }

    const existingBlock = findBlockByLiveId(editor, blockId);
    const clonedBlock = remoteBlock.cloneNode(true) as HTMLElement;
    if (existingBlock) {
      existingBlock.replaceWith(clonedBlock);
      return;
    }

    const previousRemoteId = remoteBlocks
      .slice(0, index)
      .reverse()
      .find((block) => block.dataset.liveBlockId)?.dataset.liveBlockId;
    const nextRemoteId = remoteBlocks.slice(index + 1).find((block) => block.dataset.liveBlockId)?.dataset.liveBlockId;
    const previousLocal = previousRemoteId ? findBlockByLiveId(editor, previousRemoteId) : null;
    const nextLocal = nextRemoteId ? findBlockByLiveId(editor, nextRemoteId) : null;

    if (previousLocal) {
      previousLocal.after(clonedBlock);
    } else if (nextLocal) {
      nextLocal.before(clonedBlock);
    } else {
      editor.append(clonedBlock);
    }
  });
}

function deleteSlashBeforeCaret(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) {
    return;
  }

  const caretRange = selection.getRangeAt(0);
  if (!editor.contains(caretRange.startContainer)) {
    return;
  }

  const before = caretRange.cloneRange();
  before.selectNodeContents(editor);
  before.setEnd(caretRange.endContainer, caretRange.endOffset);
  const textBeforeCaret = before.toString();
  const trimmedTextBeforeCaret = textBeforeCaret.replace(/\s+$/, "");
  const match = trimmedTextBeforeCaret.match(/\/([^\s/]*)$/);
  if (!match) {
    return;
  }

  const slashStart = trimmedTextBeforeCaret.length - match[0].trimStart().length;
  const slashRange = getTextRangeAt(editor, slashStart, trimmedTextBeforeCaret.length);
  if (!slashRange) {
    return;
  }

  slashRange.deleteContents();
  selection.removeAllRanges();
  selection.addRange(slashRange);
}

function commandMatchesQuery(command: SlashCommand, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [command.label, command.description, ...(command.keywords ?? [])].some((value) =>
    value.toLowerCase().includes(normalized)
  );
}

function createPageLinkElement({ content, icon, id, title }: { content: string; icon: string; id: string; title: string }) {
  const page = document.createElement("div");
  page.className = "notion-page-link";
  page.contentEditable = "false";
  page.dataset.pageContent = encodePageContent(content);
  page.dataset.pageIcon = icon;
  page.dataset.pageId = id;
  page.dataset.pageTitle = title;
  page.innerHTML = `<span class="notion-page-glyph" aria-hidden="true">${escapeHtml(icon)}</span><strong>${escapeHtml(title)}</strong>`;
  return page;
}

function readPageFromElement(element: HTMLElement): ActivePage {
  const icon = element.dataset.pageIcon || element.querySelector(".notion-page-glyph")?.textContent || "📄";

  return {
    content: decodePageContent(element.dataset.pageContent ?? ""),
    element,
    icon,
    id: element.dataset.pageId ?? `page-${Date.now()}`,
    title: element.dataset.pageTitle ?? element.querySelector("strong")?.textContent ?? "Neue Seite"
  };
}

function encodePageContent(content: string) {
  return encodeURIComponent(content);
}

function decodePageContent(content: string) {
  try {
    return decodeURIComponent(content);
  } catch {
    return "";
  }
}

function replaceYTextValue(yText: Y.Text, nextValue: string, origin: unknown) {
  const currentValue = yText.toString();
  if (currentValue === nextValue) {
    return;
  }

  let prefixLength = 0;
  while (
    prefixLength < currentValue.length &&
    prefixLength < nextValue.length &&
    currentValue[prefixLength] === nextValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < currentValue.length - prefixLength &&
    suffixLength < nextValue.length - prefixLength &&
    currentValue[currentValue.length - 1 - suffixLength] === nextValue[nextValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const deleteLength = currentValue.length - prefixLength - suffixLength;
  const insertValue = nextValue.slice(prefixLength, suffixLength ? nextValue.length - suffixLength : nextValue.length);

  yText.doc?.transact(() => {
    if (deleteLength > 0) {
      yText.delete(prefixLength, deleteLength);
    }
    if (insertValue) {
      yText.insert(prefixLength, insertValue);
    }
  }, origin);
}

async function loadEditorCrdtState(documentKey: string) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("app_options")
    .select("color")
    .eq("namespace", "editor-crdt-state")
    .eq("label", documentKey)
    .maybeSingle();

  if (error) {
    console.error("Yjs-State konnte nicht geladen werden:", error.message);
    return null;
  }

  return data?.color || null;
}

async function saveEditorCrdtState(documentKey: string, encodedState: string) {
  if (!hasSupabaseConfig || !supabase || !encodedState) {
    return;
  }

  let stateToSave = encodedState;
  const { data: existingState } = await supabase
    .from("app_options")
    .select("color")
    .eq("namespace", "editor-crdt-state")
    .eq("label", documentKey)
    .maybeSingle();

  if (existingState?.color && existingState.color !== encodedState) {
    try {
      stateToSave = uint8ArrayToBase64(
        Y.mergeUpdates([base64ToUint8Array(existingState.color), base64ToUint8Array(encodedState)])
      );
    } catch (error) {
      console.error("Yjs-State konnte nicht gemerged werden:", error);
    }
  }

  const { error } = await supabase.from("app_options").upsert(
    {
      namespace: "editor-crdt-state",
      label: documentKey,
      color: stateToSave,
      updated_at: new Date().toISOString()
    },
    { onConflict: "namespace,label" }
  );

  if (error) {
    console.error("Yjs-State konnte nicht gespeichert werden:", error.message);
  }
}

function uint8ArrayToBase64(update: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < update.length; index += chunkSize) {
    binary += String.fromCharCode(...update.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const update = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    update[index] = binary.charCodeAt(index);
  }
  return update;
}

function mediaFileToHtml(kind: "audio" | "image" | "page" | "video", source: string, name: string) {
  const safeName = escapeHtml(name);

  if (kind === "image") {
    return `<figure class="media-block"><img src="${source}" alt="${safeName}" /><figcaption>${safeName}</figcaption></figure><p><br></p>`;
  }

  if (kind === "video") {
    return `<figure class="media-block"><video controls src="${source}"></video><figcaption>${safeName}</figcaption></figure><p><br></p>`;
  }

  if (kind === "audio") {
    return `<figure class="media-block"><audio controls src="${source}"></audio><figcaption>${safeName}</figcaption></figure><p><br></p>`;
  }

  return "<p><br></p>";
}

function getTextRangeAt(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let offset = 0;
  const range = document.createRange();
  let foundStart = false;

  while (node) {
    const nextOffset = offset + (node.textContent?.length ?? 0);
    if (!foundStart && start >= offset && start <= nextOffset) {
      range.setStart(node, start - offset);
      foundStart = true;
    }
    if (foundStart && end >= offset && end <= nextOffset) {
      range.setEnd(node, end - offset);
      return range;
    }
    offset = nextOffset;
    node = walker.nextNode();
  }

  return null;
}

function insertHtmlAtSelection(editor: HTMLElement, html: string) {
  const selection = window.getSelection();
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const fragment = template.content;
  const lastChild = fragment.lastChild;

  if (!selection || !selection.rangeCount) {
    editor.append(fragment);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) {
    editor.append(fragment);
    return;
  }

  range.deleteContents();
  range.insertNode(fragment);

  if (lastChild) {
    range.setStartAfter(lastChild);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function insertBlockNodeAtSelection(editor: HTMLElement, node: HTMLElement) {
  const selection = window.getSelection();
  const fragment = document.createDocumentFragment();
  fragment.append(node);
  fragment.append(document.createElement("p"));
  fragment.lastElementChild!.innerHTML = "<br>";

  if (!selection || !selection.rangeCount) {
    editor.append(fragment);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) {
    editor.append(fragment);
    return;
  }

  const block = closestEditorBlock(range.startContainer, editor);
  if (!block || block === editor) {
    range.deleteContents();
    range.insertNode(fragment);
  } else if (isEditorBlockEmpty(block)) {
    block.replaceWith(fragment);
  } else {
    block.after(fragment);
  }
}

function insertBlockHtmlAtSelection(editor: HTMLElement, html: string) {
  const selection = window.getSelection();
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const fragment = template.content;
  const firstElement = fragment.firstElementChild as HTMLElement | null;

  if (!selection || !selection.rangeCount) {
    editor.append(fragment);
    if (firstElement) {
      placeCaretInInsertedBlock(firstElement);
    }
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) {
    editor.append(fragment);
    if (firstElement) {
      placeCaretInInsertedBlock(firstElement);
    }
    return;
  }

  const block = closestEditorBlock(range.startContainer, editor);
  if (!block || block === editor) {
    range.deleteContents();
    range.insertNode(fragment);
  } else if (isEditorBlockEmpty(block)) {
    block.replaceWith(fragment);
  } else {
    block.after(fragment);
  }

  if (firstElement) {
    placeCaretInInsertedBlock(firstElement);
  }
}

function placeCaretInInsertedBlock(block: HTMLElement) {
  const target =
    block.matches("table")
      ? (block.querySelector("td, th") as HTMLElement | null)
      : block.matches("details")
        ? (block.querySelector("summary") as HTMLElement | null)
      : block.matches("ul, ol")
        ? (block.querySelector("li") as HTMLElement | null)
        : block.matches("figure")
          ? null
          : block;

  if (!target) {
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  if (target.matches("h1, h2, h3") && target.textContent?.trim() === "") {
    target.innerHTML = "";
    range.setStart(target, 0);
  } else {
    range.selectNodeContents(target);
    range.collapse(false);
  }
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function closestEditorBlock(node: Node, editor: HTMLElement) {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

  while (current && current !== editor) {
    if (current.tagName === "LI" && current.parentElement?.matches("ul, ol")) {
      return current.parentElement;
    }

    if (current.matches("p, div, .notion-page-link, h1, h2, h3, details, ul, ol, table, figure")) {
      return current;
    }

    current = current.parentElement;
  }

  return editor;
}

function isEditorBlockEmpty(block: HTMLElement) {
  return block.textContent?.trim() === "" && block.querySelector("table") === null;
}

function indentListItem(item: HTMLLIElement, direction: "in" | "out") {
  const parentList = item.parentElement;
  if (!parentList?.matches("ul, ol")) {
    return;
  }

  if (direction === "in") {
    const previousItem = item.previousElementSibling as HTMLLIElement | null;
    if (!previousItem) {
      return;
    }

    const listTag = parentList.tagName.toLowerCase();
    let nestedList = Array.from(previousItem.children).find((child) => child.tagName.toLowerCase() === listTag) as
      | HTMLUListElement
      | HTMLOListElement
      | undefined;

    if (!nestedList) {
      nestedList = document.createElement(listTag) as HTMLUListElement | HTMLOListElement;
      previousItem.append(nestedList);
    }

    nestedList.append(item);
    return;
  }

  const parentItem = parentList.parentElement?.closest("li");
  if (!parentItem) {
    return;
  }

  parentItem.after(item);
  if (!parentList.querySelector(":scope > li")) {
    parentList.remove();
  }
}

function PropertyRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="property-row">
      <div className="property-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="property-value">{children}</div>
    </div>
  );
}

function useCloseOnOutside(ref: RefObject<HTMLElement | null>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [active, onClose, ref]);
}

function loadOptionSet(storageKey: string, defaults: string[]) {
  if (typeof window === "undefined") {
    return defaults;
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaults;
  }
  try {
    return Array.from(new Set([...defaults, ...(JSON.parse(raw) as string[])]));
  } catch {
    return defaults;
  }
}

function tagColor(value: string, neutral = false) {
  if (neutral) {
    const statusColors: Record<string, string> = {
      "Nicht begonnen": "#5a5a52",
      "In Planung": "#6f5c3e",
      Bereit: "#486b5b",
      Abgeschlossen: "#3f6f55"
    };
    return statusColors[value] ?? "#4a4a45";
  }

  let total = 0;
  for (const char of value) {
    total += char.charCodeAt(0);
  }
  return typePalette[total % typePalette.length];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
