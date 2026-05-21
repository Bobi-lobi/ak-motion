"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  Mail,
  MapPin,
  UsersRound,
  X
} from "lucide-react";
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createProfile, addAssignment, removeAssignment, updateEvent, updateEventNotes } from "@/lib/data-store";
import { addMonths, format, getCalendarGridDays, isDayInMonth, parseISO, subMonths, monthLabel } from "@/lib/date-utils";
import type { AssignmentRole, Event, Profile } from "@/lib/types";
import { useApp } from "@/components/app-provider";

const assignmentRoles: AssignmentRole[] = ["Ton", "Licht", "Umbau"];
const statusDefaults = ["Nicht begonnen", "In Planung", "Bereit", "Abgeschlossen"];
const typePalette = ["#9b6a64", "#7d609a", "#5f7fa3", "#6f8f72", "#a18452", "#8b6f93"];
const pageIconOptions = ["📄", "📌", "✅", "🎬", "🎤", "🎧", "💡", "🎵", "📷", "🧰", "📅", "⭐", "🔥", "🚀", "🏫", "🎭"];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
type BlockHandle = { id: string; top: number; height: number };
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
  const { data, session, isAdmin, refresh } = useApp();
  const technicians = data.profiles.filter((profile) => profile.role === "technician");
  const assignments = data.assignments.filter((item) => item.eventId === event.id);
  const typeOptions = Array.from(new Set(["Schulische Veranstaltung", "Probe", "Feier", "Konzert", ...data.events.map((item) => item.eventType).filter(Boolean)]));
  const locationOptions = Array.from(new Set(["Aula", "Bühne", "Musikraum", "Sporthalle", ...data.events.map((item) => item.location).filter(Boolean)]));
  const canChooseAllTechnicians = isAdmin;

  function patchEvent(patch: Partial<Event>) {
    updateEvent(event.id, patch);
    refresh();
  }

  function updateDate(dateValue: string) {
    const startTime = format(parseISO(event.startsAt), "HH:mm");
    const endTime = format(parseISO(event.endsAt), "HH:mm");
    patchEvent({
      startsAt: new Date(`${dateValue}T${startTime}:00`).toISOString(),
      endsAt: new Date(`${dateValue}T${endTime}:00`).toISOString()
    });
  }

  function updateTime(which: "start" | "end", timeValue: string) {
    if (!timePattern.test(timeValue)) {
      return;
    }

    const dateValue = format(parseISO(event.startsAt), "yyyy-MM-dd");
    patchEvent({
      [which === "start" ? "startsAt" : "endsAt"]: new Date(`${dateValue}T${timeValue}:00`).toISOString()
    });
  }

  return (
    <div className="page-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="page-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${event.title} bearbeiten`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="page-modal-actions">
          <button className="icon-button ghost" type="button" aria-label="Fenster schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="page-modal-inner">
          <input
            className="notion-title-input"
            value={event.title}
            onChange={(changeEvent) => patchEvent({ title: changeEvent.target.value })}
            aria-label="Veranstaltungstitel"
          />

          <div className="property-grid">
            {assignmentRoles.map((role) => (
              <PropertyRow key={role} icon={<UsersRound size={18} />} label={role}>
                <TechnicianField
                  role={role}
                  eventId={event.id}
                  technicians={technicians}
                  assignments={assignments}
                  canChooseAll={canChooseAllTechnicians}
                  currentUserId={session?.id}
                  onChange={refresh}
                />
              </PropertyRow>
            ))}

            <PropertyRow icon={<Mail size={18} />} label="Ansprechpartner">
              <input
                className="property-input"
                value={event.contactName ?? ""}
                onChange={(changeEvent) => patchEvent({ contactName: changeEvent.target.value })}
                placeholder="Leer"
              />
            </PropertyRow>
            <PropertyRow icon={<Mail size={18} />} label="E-Mail">
              <input
                className="property-input"
                value={event.contactEmail ?? ""}
                onChange={(changeEvent) => patchEvent({ contactEmail: changeEvent.target.value })}
                placeholder="Leer"
                type="email"
              />
            </PropertyRow>
            <PropertyRow icon={<CalendarDays size={18} />} label="Datum">
              <DatePicker value={format(parseISO(event.startsAt), "yyyy-MM-dd")} onChange={updateDate} />
            </PropertyRow>
            <PropertyRow icon={<Clock size={18} />} label="Uhrzeit">
              <div className="time-input-row">
                <TimeInput
                  value={format(parseISO(event.startsAt), "HH:mm")}
                  onChange={(value) => updateTime("start", value)}
                  ariaLabel="Startzeit"
                />
                <span>-</span>
                <TimeInput
                  value={format(parseISO(event.endsAt), "HH:mm")}
                  onChange={(value) => updateTime("end", value)}
                  ariaLabel="Endzeit"
                />
              </div>
            </PropertyRow>
            <PropertyRow icon={<MapPin size={18} />} label="Ort">
              <TagSelect
                storageKey="ak-motion-location-options"
                value={event.location}
                defaults={locationOptions}
                emptyLabel="Leer"
                onChange={(value) => patchEvent({ location: value })}
              />
            </PropertyRow>
            <PropertyRow icon={<Hash size={18} />} label="Typ">
              <TagSelect
                storageKey="ak-motion-event-types"
                value={event.eventType}
                defaults={typeOptions}
                emptyLabel="Leer"
                onChange={(value) => patchEvent({ eventType: value })}
              />
            </PropertyRow>
            <PropertyRow icon={<CheckCircle2 size={18} />} label="Status">
              <TagSelect
                storageKey="ak-motion-status-options"
                value={event.status ?? "Nicht begonnen"}
                defaults={statusDefaults}
                emptyLabel="Leer"
                neutral
                onChange={(value) => patchEvent({ status: value })}
              />
            </PropertyRow>
          </div>

          <section className="notion-document">
            <h2>Notizen</h2>
            <SlashRichTextEditor
              key={event.id}
              value={event.notes}
              onChange={(changeEvent) => {
                updateEventNotes(event.id, changeEvent);
                refresh();
              }}
              placeholder="Ablauf, Aufbauplan, Sonderwünsche, Links oder interne Hinweise..."
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
  currentUserId,
  onChange
}: {
  role: AssignmentRole;
  eventId: string;
  technicians: Profile[];
  assignments: Array<{ profileId: string; role: AssignmentRole }>;
  canChooseAll: boolean;
  currentUserId?: string;
  onChange: () => void;
}) {
  const selectedIds = assignments.filter((assignment) => assignment.role === role).map((assignment) => assignment.profileId);
  const visibleTechnicians = canChooseAll
    ? technicians
    : technicians.filter((profile) => profile.id === currentUserId || selectedIds.includes(profile.id));

  return (
    <MultiTagPicker
      selected={selectedIds}
      options={visibleTechnicians.map((profile) => ({ value: profile.id, label: profile.name }))}
      emptyLabel="Leer"
      canCreate={canChooseAll}
      onAdd={(profileId) => {
        addAssignment(eventId, profileId, role);
        onChange();
      }}
      onRemove={(profileId) => {
        removeAssignment(eventId, profileId, role);
        onChange();
      }}
      onCreate={(name) => {
        const profile = createProfile(name, `${slugify(name)}@ak-motion.local`);
        addAssignment(eventId, profile.id, role);
        onChange();
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

  function saveOptions(next: string[]) {
    setLocalOptions(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function createAndSelect(label: string) {
    const clean = label.trim();
    if (!clean) {
      return;
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
                  createAndSelect(query);
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
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  saveOptions(options.filter((item) => item !== option));
                }}
              />
            </button>
          ))}
          {query.trim() && !options.includes(query.trim()) ? (
            <button className="tag-create-option" type="button" onClick={() => createAndSelect(query)}>
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
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
  canCreate?: boolean;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onCreate?: (label: string) => void;
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
              <span className="people-chip">{option.label}</span>
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
  value,
  onChange,
  placeholder
}: {
  ariaLabel?: string;
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
  const blockIdsRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());
  const blockElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const dragBlockIdRef = useRef<string | null>(null);
  const latestEditorHtmlRef = useRef(normalizeNoteHtml(value));
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
  useCloseOnOutside(shellRef, () => setSlashOpen(false), slashOpen);
  useCloseOnOutside(pageIconPickerRef, () => setPageIconPickerOpen(false), pageIconPickerOpen);

  const commands: SlashCommand[] = [
    { label: "H1", description: "Große Überschrift", html: "<h1><br></h1><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
    { label: "H2", description: "Zwischenüberschrift", html: "<h2><br></h2><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
    { label: "H3", description: "Abschnitt", html: "<h3><br></h3><p><br></p>", keywords: ["heading", "überschrift"], section: "basis" },
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
    if (editor.contains(document.activeElement) && latestEditorHtmlRef.current !== nextHtml) {
      refreshBlockHandles(editor);
      return;
    }

    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
    latestEditorHtmlRef.current = nextHtml;
    setIsEmpty(isEditorBlank(editor));
    refreshBlockHandles(editor);
  }, [value]);

  function syncEditor(openSlashMenu = true) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const blank = isEditorBlank(editor);
    const nextHtml = blank ? "" : editor.innerHTML;
    setIsEmpty(blank);
    latestEditorHtmlRef.current = nextHtml;
    onChange(nextHtml);
    const slashState = getSlashState(editor);
    setSlashOpen(openSlashMenu && slashState.active);
    setSlashQuery(slashState.query);
    refreshBlockHandles(editor);
    updateTableControls();
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

    const nextHtml = editor.innerHTML;
    setIsEmpty(isEditorBlank(editor));
    latestEditorHtmlRef.current = nextHtml;
    onChange(nextHtml);
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

  function handleMediaSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    const command = pendingMediaCommandRef.current;
    pendingMediaCommandRef.current = null;

    if (!file || !command?.action) {
      return;
    }

    const editor = editorRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result ?? "");
      if (!editor || !source) {
        return;
      }

      const html = mediaFileToHtml(command.action!, source, file.name);
      insertBlockHtmlAtSelection(editor, html);
      const nextHtml = editor.innerHTML;
      latestEditorHtmlRef.current = nextHtml;
      onChange(nextHtml);
      setIsEmpty(isEditorBlank(editor));
      refreshBlockHandles(editor);
    };
    reader.readAsDataURL(file);
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
    const block = target.closest("p, div, h1, h2, h3, ul, ol, table, figure, .notion-page-link, li") as HTMLElement | null;
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
    const existing = blockIdsRef.current.get(element);
    if (existing) {
      return existing;
    }

    const id = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    blockIdsRef.current.set(element, id);
    return id;
  }

  function refreshBlockHandles(editor = editorRef.current) {
    const shell = shellRef.current;
    if (!editor || !shell) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const blockMap = new Map<string, HTMLElement>();
    const blocks = Array.from(
      editor.querySelectorAll<HTMLElement>(
        ":scope > p, :scope > div:not(.notion-page-link), :scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > .notion-page-link, li"
      )
    );

    const nextHandles = blocks
      .filter((block) => !block.closest(".notion-page-link") || block.classList.contains("notion-page-link"))
      .map((block) => {
        const rect = block.getBoundingClientRect();
        const id = getBlockId(block);
        blockMap.set(id, block);
        return { id, top: rect.top - shellRect.top, height: rect.height };
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

  return (
    <div className="slash-editor" ref={shellRef}>
      <div className="block-handle-layer" aria-hidden="true">
        {blockHandles.map((handle) => (
          <button
            className={[
              "block-handle",
              handle.id === hoveredBlockId || draggingBlockId ? "is-visible" : "",
              handle.id === draggingBlockId ? "is-dragging" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={handle.id}
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

  if (/<(p|br|h1|h2|h3|ul|ol|li|table|tbody|tr|th|td|strong|em|div|figure|figcaption|img|video|audio|source)\b/i.test(trimmed)) {
    return trimmed;
  }

  return textToHtml(value);
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

    if (current.matches("p, div, .notion-page-link, h1, h2, h3, ul, ol, table, figure")) {
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
