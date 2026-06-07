"use client";

import { Check, ChevronDown, CircleDot, Database, GripVertical, Hash, MoreHorizontal, Plus, Text, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";

type ColumnType = "number" | "select" | "text";
type EquipmentColumn = { id: string; name: string; type: ColumnType; icon: "number" | "select" | "text" };
type EquipmentRow = { id: string; cells: Record<string, string> };
type EquipmentData = { columns: EquipmentColumn[]; rows: EquipmentRow[] };
type EquipmentTagState = Record<string, { options: string[]; colors: Record<string, string> }>;
type OpenSelect = { rowId: string; columnId: string; x: number; y: number; width: number } | null;
type RowContextMenu = { rowId: string; x: number; y: number } | null;

const STORAGE_KEY = "ak-motion-equipment-database";
const TAGS_STORAGE_KEY = "ak-motion-equipment-tags";
const defaultColumns: EquipmentColumn[] = [
  { id: "name", name: "Name", type: "text", icon: "text" },
  { id: "amount", name: "Anzahl", type: "number", icon: "number" },
  { id: "type", name: "Typ", type: "select", icon: "select" },
  { id: "state", name: "Zustand", type: "select", icon: "select" },
  { id: "where", name: "Wo?", type: "text", icon: "text" },
  { id: "comment", name: "Kommentar", type: "text", icon: "text" }
];
const selectDefaults: Record<string, string[]> = {
  state: ["Einwandfrei", "Voll", "Leer", "Kaputt", "Ausgeliehen"],
  type: ["Akku", "Mikrofon", "Kabel", "Licht", "Pult", "Sonstiges"]
};
const tagPalette = ["#3f765c", "#765842", "#69558a", "#5f708d", "#7d6f3c", "#7d4a48", "#4a4a45"];

export default function EquipmentPage() {
  const [data, setData] = useState<EquipmentData>(() => loadEquipmentData());
  const [tagState, setTagState] = useState<EquipmentTagState>(() => loadTagState());
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenu>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const selectableValues = useMemo(() => {
    const values: Record<string, string[]> = {};
    data.columns.forEach((column) => {
      if (column.type !== "select") {
        return;
      }
      const tagOptions = tagState[column.id]?.options ?? [];
      values[column.id] = Array.from(
        new Set([...tagOptions, ...data.rows.map((row) => row.cells[column.id]).filter(Boolean)])
      );
    });
    return values;
  }, [data, tagState]);
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data.rows.filter((row) => {
      const name = (row.cells.name ?? "").toLowerCase();
      const type = row.cells.type ?? "";
      const state = row.cells.state ?? "";
      const matchesQuery = !query || name.includes(query);
      const matchesType = !typeFilter || type === typeFilter;
      const matchesState = !stateFilter || state === stateFilter;
      return matchesQuery && matchesType && matchesState;
    });
  }, [data.rows, searchQuery, stateFilter, typeFilter]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    window.localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagState));
  }, [tagState]);

  function patchData(patch: (current: EquipmentData) => EquipmentData) {
    setData((current) => patch(current));
  }

  function addRow() {
    patchData((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          id: createId("equipment"),
          cells: Object.fromEntries(current.columns.map((column) => [column.id, column.type === "number" ? "1" : ""]))
        }
      ]
    }));
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    patchData((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row))
    }));
  }

  function deleteRow(rowId: string) {
    patchData((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }));
    setRowContextMenu(null);
  }

  function createTag(columnId: string, label: string) {
    const clean = label.trim();
    if (!clean) {
      return;
    }

    setTagState((current) => {
      const currentColumn = current[columnId] ?? { options: [], colors: {} };
      return {
        ...current,
        [columnId]: {
          options: Array.from(new Set([...currentColumn.options, clean])),
          colors: { ...currentColumn.colors, [clean]: currentColumn.colors[clean] ?? tagColor(clean, columnId, currentColumn.colors) }
        }
      };
    });
  }

  function deleteTag(columnId: string, label: string) {
    setTagState((current) => {
      const currentColumn = current[columnId] ?? { options: [], colors: {} };
      const { [label]: _removedColor, ...colors } = currentColumn.colors;
      return {
        ...current,
        [columnId]: {
          options: currentColumn.options.filter((option) => option !== label),
          colors
        }
      };
    });
    patchData((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.cells[columnId] === label ? { ...row, cells: { ...row.cells, [columnId]: "" } } : row))
    }));
  }

  function updateTagColor(columnId: string, label: string, color: string) {
    setTagState((current) => {
      const currentColumn = current[columnId] ?? { options: [], colors: {} };
      return {
        ...current,
        [columnId]: {
          options: currentColumn.options.includes(label) ? currentColumn.options : [...currentColumn.options, label],
          colors: { ...currentColumn.colors, [label]: color }
        }
      };
    });
  }

  function openRowMenu(rowId: string, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setRowContextMenu({ rowId, x: event.clientX, y: event.clientY });
  }

  function toggleSelect(rowId: string, columnId: string, event: ReactMouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 320;
    const y = rect.bottom + menuHeight > window.innerHeight ? Math.max(12, rect.top - menuHeight - 6) : rect.bottom + 6;
    const menuWidth = Math.min(360, window.innerWidth - 24);
    const x = Math.min(Math.max(12, rect.left), window.innerWidth - menuWidth - 12);
    setOpenSelect((current) =>
      current?.rowId === rowId && current.columnId === columnId
        ? null
        : { rowId, columnId, x, y, width: menuWidth }
    );
  }

  return (
    <RouteGuard>
      <AppShell title="Equipment" eyebrow="Datenbank" contentClassName="equipment-page" titleIcon={<Database size={30} />}>
        <section className="equipment-database">
          <div className="equipment-toolbar">
            <span className="equipment-count">
              {filteredRows.length} von {data.rows.length} Einträgen
            </span>
            <div className="equipment-filters">
              <label>
                <span>Name suchen</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Equipment suchen..." />
              </label>
              <label>
                <span>Art</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">Alle Arten</option>
                  {(selectableValues.type ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Zustand</span>
                <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                  <option value="">Alle Zustände</option>
                  {(selectableValues.state ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="equipment-table-wrap">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th className="equipment-handle-col" />
                  {data.columns.map((column) => (
                    <th key={column.id}>
                      <div className="equipment-column-head">
                        <ColumnIcon type={column.icon} />
                        <span>{column.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="equipment-handle-col">
                      <button
                        className="equipment-row-handle"
                        type="button"
                        aria-label="Zeilenmenü öffnen"
                        onClick={(event) => openRowMenu(row.id, event)}
                        onContextMenu={(event) => openRowMenu(row.id, event)}
                      >
                        <GripVertical size={17} />
                      </button>
                    </td>
                    {data.columns.map((column) => (
                      <td key={column.id}>
                        {column.type === "select" ? (
                          <EquipmentSelect
                            columnId={column.id}
                            openSelect={openSelect?.rowId === row.id && openSelect.columnId === column.id ? openSelect : null}
                            options={selectableValues[column.id] ?? []}
                            value={row.cells[column.id] ?? ""}
                            colors={tagState[column.id]?.colors ?? {}}
                            onChange={(value) => updateCell(row.id, column.id, value)}
                            onCreate={(label) => createTag(column.id, label)}
                            onDelete={(label) => deleteTag(column.id, label)}
                            onColorChange={(label, color) => updateTagColor(column.id, label, color)}
                            onToggle={(event) => toggleSelect(row.id, column.id, event)}
                            onClose={() => setOpenSelect(null)}
                          />
                        ) : (
                          <input
                            value={row.cells[column.id] ?? ""}
                            onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                            type={column.type === "number" ? "number" : "text"}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td className="equipment-empty-row" colSpan={data.columns.length + 1}>
                      Keine Einträge gefunden.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <button className="equipment-add-row" type="button" onClick={addRow}>
              <Plus size={16} />
              Neue Zeile
            </button>
          </div>
        </section>
        {rowContextMenu ? (
          <>
            <div className="context-scrim" role="presentation" onClick={() => setRowContextMenu(null)} />
            <div className="calendar-context-menu" style={{ left: rowContextMenu.x, top: rowContextMenu.y }}>
              <button className="danger" type="button" onClick={() => deleteRow(rowContextMenu.rowId)}>
                <Trash2 size={15} />
                Zeile löschen
              </button>
            </div>
          </>
        ) : null}
      </AppShell>
    </RouteGuard>
  );
}

function ColumnIcon({ type }: { type: EquipmentColumn["icon"] }) {
  if (type === "number") {
    return <Hash size={16} />;
  }

  if (type === "select") {
    return <CircleDot size={16} />;
  }

  return <Text size={16} />;
}

function EquipmentSelect({
  columnId,
  value,
  options,
  openSelect,
  colors,
  onChange,
  onCreate,
  onDelete,
  onColorChange,
  onToggle,
  onClose
}: {
  columnId: string;
  value: string;
  options: string[];
  openSelect: OpenSelect;
  colors: Record<string, string>;
  onChange: (value: string) => void;
  onCreate: (label: string) => void;
  onDelete: (label: string) => void;
  onColorChange: (label: string, color: string) => void;
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editingTag, setEditingTag] = useState<{ label: string; x: number; y: number } | null>(null);
  const canCreate = query.trim() && !options.includes(query.trim());

  function createAndSelect() {
    const clean = query.trim();
    if (!clean) {
      return;
    }

    onCreate(clean);
    onChange(clean);
    setQuery("");
    setEditingTag(null);
    onClose();
  }

  return (
    <div className="equipment-select">
      <button className="equipment-select-trigger" type="button" onClick={onToggle}>
        {value ? (
          <span className={columnId === "state" ? "property-tag neutral state" : "property-tag"} style={{ background: tagColor(value, columnId, colors) }}>
            {value}
          </span>
        ) : (
          <span className="property-empty">Leer</span>
        )}
        <ChevronDown size={15} />
      </button>
      {openSelect ? (
        <>
          <div className="equipment-select-scrim" role="presentation" onClick={onClose} />
          {editingTag ? <div className="equipment-tag-edit-scrim" role="presentation" onClick={() => setEditingTag(null)} /> : null}
          <div
            className="tag-picker-menu equipment-select-menu"
            style={{ left: openSelect.x, position: "fixed", top: openSelect.y, width: openSelect.width }}
          >
            <div className="tag-input-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createAndSelect();
                  }
                }}
                placeholder="Option auswählen oder erstellen"
              />
            </div>
            <span className="tag-menu-heading">Option auswählen oder erstellen</span>
            <button
              className="tag-option"
              type="button"
              onClick={() => {
                onChange("");
                onClose();
              }}
            >
              <span className="property-empty">Leer</span>
            </button>
            {options.map((option) => (
              <div className="equipment-tag-option" key={option}>
                <button
                  className="tag-option"
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setEditingTag(null);
                    onClose();
                  }}
                >
                  <span className={columnId === "state" ? "property-tag neutral state" : "property-tag"} style={{ background: tagColor(option, columnId, colors) }}>
                    {option}
                  </span>
                </button>
                <button
                  className="equipment-tag-more"
                  type="button"
                  aria-label={`${option} bearbeiten`}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const menuWidth = Math.min(260, window.innerWidth - 24);
                    const x = Math.min(rect.right + 8, window.innerWidth - menuWidth - 12);
                    setEditingTag((current) => (current?.label === option ? null : { label: option, x, y: rect.top }));
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))}
            {canCreate ? (
              <button className="tag-create-option" type="button" onClick={createAndSelect}>
                <Plus size={15} />
                {query.trim()} erstellen
              </button>
            ) : null}
          </div>
          {editingTag ? (
            <div className="equipment-tag-edit-menu" style={{ left: editingTag.x, top: editingTag.y }}>
              <div className="equipment-tag-edit-head">
                <span
                  className={columnId === "state" ? "property-tag neutral state" : "property-tag"}
                  style={{ background: tagColor(editingTag.label, columnId, colors) }}
                >
                  {editingTag.label}
                </span>
              </div>
              <button
                className="equipment-tag-delete-row"
                type="button"
                onClick={() => {
                  onDelete(editingTag.label);
                  setEditingTag(null);
                }}
              >
                <Trash2 size={17} />
                Löschen
              </button>
              <span className="equipment-tag-edit-label">Farben</span>
              <div className="equipment-tag-color-list">
                {tagPalette.map((color) => (
                  <button
                    className="equipment-tag-color-row"
                    key={color}
                    type="button"
                    onClick={() => onColorChange(editingTag.label, color)}
                  >
                    <span className="equipment-color-swatch" style={{ background: color }} />
                    {colorName(color)}
                    {colors[editingTag.label] === color ? <Check size={16} /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function loadEquipmentData(): EquipmentData {
  if (typeof window === "undefined") {
    return createDefaultEquipmentData();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultEquipmentData();
  }

  try {
    return normalizeEquipmentData(JSON.parse(raw) as EquipmentData);
  } catch {
    return createDefaultEquipmentData();
  }
}

function loadTagState(): EquipmentTagState {
  if (typeof window === "undefined") {
    return createDefaultTagState();
  }

  const raw = window.localStorage.getItem(TAGS_STORAGE_KEY);
  if (!raw) {
    return createDefaultTagState();
  }

  try {
    return normalizeTagState(JSON.parse(raw) as EquipmentTagState);
  } catch {
    return createDefaultTagState();
  }
}

function createDefaultEquipmentData(): EquipmentData {
  return {
    columns: defaultColumns,
    rows: [
      {
        id: createId("equipment"),
        cells: {
          name: "Funkmikrofon",
          amount: "2",
          type: "Mikrofon",
          state: "Voll",
          where: "Aula Technikschrank",
          comment: ""
        }
      }
    ]
  };
}

function normalizeEquipmentData(value: EquipmentData): EquipmentData {
  return {
    columns: defaultColumns,
    rows: (value.rows?.length ? value.rows : createDefaultEquipmentData().rows).map((row) => ({
      id: row.id || createId("equipment"),
      cells: Object.fromEntries(defaultColumns.map((column) => [column.id, row.cells?.[column.id] ?? (column.type === "number" ? "1" : "")]))
    }))
  };
}

function createDefaultTagState(): EquipmentTagState {
  return normalizeTagState({});
}

function normalizeTagState(value: EquipmentTagState): EquipmentTagState {
  return Object.fromEntries(
    defaultColumns
      .filter((column) => column.type === "select")
      .map((column) => {
        const options = Array.from(new Set([...(selectDefaults[column.id] ?? []), ...(value[column.id]?.options ?? [])]));
        const colors = Object.fromEntries(options.map((option) => [option, value[column.id]?.colors?.[option] ?? tagColor(option, column.id, {})]));
        return [column.id, { options, colors }];
      })
  );
}

function tagColor(value: string, columnId: string, colors: Record<string, string>) {
  if (colors[value]) {
    return colors[value];
  }

  if (columnId === "state") {
    const colors: Record<string, string> = {
      Einwandfrei: "#3f765c",
      Voll: "#3f765c",
      Leer: "#4a4a45",
      Kaputt: "#7d4a48",
      Ausgeliehen: "#715c8f"
    };
    return colors[value] ?? "#4a4a45";
  }

  const palette: Record<string, string> = {
    Akku: "#765842",
    Mikrofon: "#69558a",
    Kabel: "#5f708d",
    Licht: "#7d6f3c",
    Pult: "#765842",
    Sonstiges: "#4a4a45"
  };
  return palette[value] ?? "#633f3d";
}

function colorName(color: string) {
  const names: Record<string, string> = {
    "#3f765c": "Grün",
    "#765842": "Braun",
    "#69558a": "Lila",
    "#5f708d": "Blau",
    "#7d6f3c": "Gelb",
    "#7d4a48": "Rot",
    "#4a4a45": "Grau"
  };
  return names[color] ?? "Farbe";
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
