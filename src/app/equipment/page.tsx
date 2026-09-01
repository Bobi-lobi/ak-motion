"use client";

import { Check, ChevronDown, CircleDot, Database, GripVertical, Hash, MoreHorizontal, Plus, Text, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type ColumnType = "number" | "select" | "text";
type EquipmentColumn = { id: string; name: string; type: ColumnType; icon: "number" | "select" | "text" };
type EquipmentRow = { id: string; cells: Record<string, string> };
type EquipmentData = { columns: EquipmentColumn[]; rows: EquipmentRow[] };
type EquipmentTagState = Record<string, { options: string[]; colors: Record<string, string> }>;
type OpenSelect = { rowId: string; columnId: string; x: number; y: number; width: number } | null;
type OpenFilter = { id: "filters" | "group"; x: number; y: number; width: number } | null;
type EquipmentGroupMode = "none" | "type" | "state";
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
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenu>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [groupMode, setGroupMode] = useState<EquipmentGroupMode>("none");
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
  const groupedRows = useMemo(() => {
    if (groupMode === "none") {
      return [{ key: "all", label: "", rows: filteredRows }];
    }

    const groups = new Map<string, EquipmentRow[]>();
    filteredRows.forEach((row) => {
      const label = row.cells[groupMode] || "Ohne Angabe";
      groups.set(label, [...(groups.get(label) ?? []), row]);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, "de"))
      .map(([label, rows]) => ({ key: `${groupMode}-${label}`, label, rows }));
  }, [filteredRows, groupMode]);

  useEffect(() => {
    if (hasSupabaseConfig && supabase) {
      void loadRemoteEquipment().then(({ equipment, tags }) => {
        setData(equipment);
        setTagState(tags);
      });
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    function scheduleEquipmentRefresh() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void loadRemoteEquipment().then(({ equipment, tags }) => {
          setData(equipment);
          setTagState(tags);
          window.dispatchEvent(new Event("ak-motion-equipment"));
        });
      }, 180);
    }

    const channel = supabaseClient
      .channel("ak-motion-equipment")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_items" }, scheduleEquipmentRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_tags" }, scheduleEquipmentRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      void supabaseClient.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (hasSupabaseConfig) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (hasSupabaseConfig) {
      return;
    }
    window.localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagState));
  }, [tagState]);

  function patchData(patch: (current: EquipmentData) => EquipmentData) {
    setData((current) => patch(current));
  }

  async function addRow() {
    if (hasSupabaseConfig && supabase) {
      const cells = Object.fromEntries(data.columns.map((column) => [column.id, column.type === "number" ? "1" : ""]));
      const { data: row, error } = await supabase
        .from("equipment_items")
        .insert(toEquipmentRecord(cells))
        .select("id, name, amount, type, state, location, comment")
        .single();
      if (error || !row) {
        throw new Error(error?.message ?? "Equipment-Zeile konnte nicht erstellt werden.");
      }
      setData((current) => ({ ...current, rows: [...current.rows, fromEquipmentRecord(row)] }));
      window.dispatchEvent(new Event("ak-motion-equipment"));
      return;
    }

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
    window.dispatchEvent(new Event("ak-motion-equipment"));
  }

  async function updateCell(rowId: string, columnId: string, value: string) {
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("equipment_items").update(toEquipmentPatch(columnId, value)).eq("id", rowId);
      if (error) {
        throw new Error(error.message);
      }
    }

    patchData((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row))
    }));
    window.dispatchEvent(new Event("ak-motion-equipment"));
  }

  async function deleteRow(rowId: string) {
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("equipment_items").delete().eq("id", rowId);
      if (error) {
        throw new Error(error.message);
      }
    }
    patchData((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }));
    setRowContextMenu(null);
    window.dispatchEvent(new Event("ak-motion-equipment"));
  }

  async function createTag(columnId: string, label: string) {
    const clean = label.trim();
    if (!clean) {
      return;
    }

    const color = tagState[columnId]?.colors[clean] ?? tagColor(clean, columnId, {});
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("equipment_tags").upsert(
        {
          column_id: columnId,
          label: clean,
          color
        },
        { onConflict: "column_id,label" }
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    setTagState((current) => {
      const currentColumn = current[columnId] ?? { options: [], colors: {} };
      return {
        ...current,
        [columnId]: {
          options: Array.from(new Set([...currentColumn.options, clean])),
          colors: { ...currentColumn.colors, [clean]: currentColumn.colors[clean] ?? color }
        }
      };
    });
  }

  async function deleteTag(columnId: string, label: string) {
    if (hasSupabaseConfig && supabase) {
      const { error: tagError } = await supabase.from("equipment_tags").delete().eq("column_id", columnId).eq("label", label);
      const { error: itemError } = await supabase.from("equipment_items").update(toEquipmentPatch(columnId, "")).eq(equipmentColumnName(columnId), label);
      if (tagError || itemError) {
        throw new Error(tagError?.message ?? itemError?.message ?? "Tag konnte nicht gelöscht werden.");
      }
    }

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

  async function updateTagColor(columnId: string, label: string, color: string) {
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("equipment_tags").upsert(
        {
          column_id: columnId,
          label,
          color
        },
        { onConflict: "column_id,label" }
      );
      if (error) {
        throw new Error(error.message);
      }
    }

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
    setOpenFilter(null);
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

  function toggleFilter(id: NonNullable<OpenFilter>["id"], event: ReactMouseEvent<HTMLButtonElement>) {
    setOpenSelect(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = id === "filters" ? 420 : 280;
    const menuWidth = Math.min(id === "filters" ? 360 : 280, window.innerWidth - 24);
    const y = rect.bottom + menuHeight > window.innerHeight ? Math.max(12, rect.top - menuHeight - 6) : rect.bottom + 6;
    const x = Math.min(Math.max(12, rect.left), window.innerWidth - menuWidth - 12);
    setOpenFilter((current) => (current?.id === id ? null : { id, x, y, width: menuWidth }));
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
                <span>Filter</span>
                <EquipmentFilterMenu
                  openFilter={openFilter}
                  typeFilter={typeFilter}
                  stateFilter={stateFilter}
                  typeOptions={selectableValues.type ?? []}
                  stateOptions={selectableValues.state ?? []}
                  typeColors={tagState.type?.colors ?? {}}
                  stateColors={tagState.state?.colors ?? {}}
                  onToggle={toggleFilter}
                  onClose={() => setOpenFilter(null)}
                  onTypeChange={setTypeFilter}
                  onStateChange={setStateFilter}
                />
              </label>
              <label>
                <span>Sortieren</span>
                <EquipmentFilterSelect
                  id="group"
                  label="Nicht gruppieren"
                  value={groupMode === "none" ? "" : groupMode}
                  options={["type", "state"]}
                  optionLabels={{ type: "Nach Art gruppieren", state: "Nach Zustand gruppieren" }}
                  openFilter={openFilter}
                  colors={{}}
                  onToggle={toggleFilter}
                  onChange={(value) => {
                    setGroupMode((value || "none") as EquipmentGroupMode);
                    setOpenFilter(null);
                  }}
                />
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
                {groupedRows.map((group) => (
                  <EquipmentGroup
                    key={group.key}
                    group={group}
                    columns={data.columns}
                    openSelect={openSelect}
                    selectableValues={selectableValues}
                    tagState={tagState}
                    onOpenRowMenu={openRowMenu}
                    onUpdateCell={(rowId, columnId, value) => void updateCell(rowId, columnId, value)}
                    onCreateTag={(columnId, label) => void createTag(columnId, label)}
                    onDeleteTag={(columnId, label) => void deleteTag(columnId, label)}
                    onColorChange={(columnId, label, color) => void updateTagColor(columnId, label, color)}
                    onToggleSelect={toggleSelect}
                    onCloseSelect={() => setOpenSelect(null)}
                  />
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
            <button className="equipment-add-row" type="button" onClick={() => void addRow()}>
              <Plus size={16} />
              Neue Zeile
            </button>
          </div>
        </section>
        {rowContextMenu ? (
          <>
            <div className="context-scrim" role="presentation" onClick={() => setRowContextMenu(null)} />
            <div className="calendar-context-menu" style={{ left: rowContextMenu.x, top: rowContextMenu.y }}>
              <button className="danger" type="button" onClick={() => void deleteRow(rowContextMenu.rowId)}>
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

function EquipmentGroup({
  group,
  columns,
  openSelect,
  selectableValues,
  tagState,
  onOpenRowMenu,
  onUpdateCell,
  onCreateTag,
  onDeleteTag,
  onColorChange,
  onToggleSelect,
  onCloseSelect
}: {
  group: { key: string; label: string; rows: EquipmentRow[] };
  columns: EquipmentColumn[];
  openSelect: OpenSelect;
  selectableValues: Record<string, string[]>;
  tagState: EquipmentTagState;
  onOpenRowMenu: (rowId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onUpdateCell: (rowId: string, columnId: string, value: string) => void;
  onCreateTag: (columnId: string, label: string) => void;
  onDeleteTag: (columnId: string, label: string) => void;
  onColorChange: (columnId: string, label: string, color: string) => void;
  onToggleSelect: (rowId: string, columnId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onCloseSelect: () => void;
}) {
  return (
    <>
      {group.label ? (
        <tr className="equipment-group-row">
          <td colSpan={columns.length + 1}>
            <span>{group.label}</span>
            <strong>{group.rows.length}</strong>
          </td>
        </tr>
      ) : null}
      {group.rows.map((row) => (
        <tr key={row.id}>
          <td className="equipment-handle-col">
            <button
              className="equipment-row-handle"
              type="button"
              aria-label="Zeilenmenü öffnen"
              onClick={(event) => onOpenRowMenu(row.id, event)}
              onContextMenu={(event) => onOpenRowMenu(row.id, event)}
            >
              <GripVertical size={17} />
            </button>
          </td>
          {columns.map((column) => (
            <td key={column.id}>
              {column.type === "select" ? (
                <EquipmentSelect
                  columnId={column.id}
                  openSelect={openSelect?.rowId === row.id && openSelect.columnId === column.id ? openSelect : null}
                  options={selectableValues[column.id] ?? []}
                  value={row.cells[column.id] ?? ""}
                  colors={tagState[column.id]?.colors ?? {}}
                  onChange={(value) => onUpdateCell(row.id, column.id, value)}
                  onCreate={(label) => onCreateTag(column.id, label)}
                  onDelete={(label) => onDeleteTag(column.id, label)}
                  onColorChange={(label, color) => onColorChange(column.id, label, color)}
                  onToggle={(event) => onToggleSelect(row.id, column.id, event)}
                  onClose={onCloseSelect}
                />
              ) : (
                <input
                  value={row.cells[column.id] ?? ""}
                  onChange={(event) => onUpdateCell(row.id, column.id, event.target.value)}
                  type={column.type === "number" ? "number" : "text"}
                />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EquipmentFilterMenu({
  openFilter,
  typeFilter,
  stateFilter,
  typeOptions,
  stateOptions,
  typeColors,
  stateColors,
  onToggle,
  onClose,
  onTypeChange,
  onStateChange
}: {
  openFilter: OpenFilter;
  typeFilter: string;
  stateFilter: string;
  typeOptions: string[];
  stateOptions: string[];
  typeColors: Record<string, string>;
  stateColors: Record<string, string>;
  onToggle: (id: NonNullable<OpenFilter>["id"], event: ReactMouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
  onTypeChange: (value: string) => void;
  onStateChange: (value: string) => void;
}) {
  const isOpen = openFilter?.id === "filters";
  const activeCount = Number(Boolean(typeFilter)) + Number(Boolean(stateFilter));

  const filterLabel = useMemo(() => {
    if (typeFilter && stateFilter) {
      return `${typeFilter} • ${stateFilter}`;
    }
    if (typeFilter) {
      return typeFilter;
    }
    if (stateFilter) {
      return stateFilter;
    }
    return "Alle Einträge";
  }, [typeFilter, stateFilter]);

  return (
    <div className="equipment-filter-select">
      <button className="equipment-filter-trigger" type="button" onClick={(event) => onToggle("filters", event)}>
        <span className={activeCount ? "equipment-filter-value" : "property-empty"}>
          {filterLabel}
        </span>
        <ChevronDown size={15} />
      </button>
      {isOpen && openFilter
        ? createPortal(
            <>
              <div className="equipment-select-scrim" role="presentation" onClick={onClose} />
              <div
                className="tag-picker-menu equipment-filter-menu equipment-combined-filter-menu"
                style={{ left: openFilter.x, top: openFilter.y, width: openFilter.width }}
              >
                <EquipmentFilterSection
                  label="Art"
                  emptyLabel="Alle Arten"
                  value={typeFilter}
                  options={typeOptions}
                  colors={typeColors}
                  columnId="type"
                  onChange={(value) => {
                    onTypeChange(value);
                    onClose();
                  }}
                />
                <EquipmentFilterSection
                  label="Zustand"
                  emptyLabel="Alle Zustände"
                  value={stateFilter}
                  options={stateOptions}
                  colors={stateColors}
                  columnId="state"
                  onChange={(value) => {
                    onStateChange(value);
                    onClose();
                  }}
                />
                {activeCount ? (
                  <button
                    className="tag-create-option"
                    type="button"
                    onClick={() => {
                      onTypeChange("");
                      onStateChange("");
                      onClose();
                    }}
                  >
                    Filter zurücksetzen
                  </button>
                ) : null}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

function EquipmentFilterSection({
  label,
  emptyLabel,
  value,
  options,
  colors,
  columnId,
  onChange
}: {
  label: string;
  emptyLabel: string;
  value: string;
  options: string[];
  colors: Record<string, string>;
  columnId: "type" | "state";
  onChange: (value: string) => void;
}) {
  return (
    <section className="equipment-filter-section">
      <span>{label}</span>
      <button className="tag-option" type="button" onClick={() => onChange("")}>
        <span className={value ? "property-empty" : "equipment-filter-value"}>{emptyLabel}</span>
        {!value ? <Check size={15} /> : null}
      </button>
      {options.map((option) => (
        <button className="tag-option" type="button" key={option} onClick={() => onChange(option)}>
          <span className={columnId === "state" ? "property-tag neutral state" : "property-tag"} style={{ background: tagColor(option, columnId, colors) }}>
            {option}
          </span>
          {value === option ? <Check size={15} /> : null}
        </button>
      ))}
    </section>
  );
}

function EquipmentFilterSelect({
  id,
  label,
  value,
  options,
  optionLabels = {},
  openFilter,
  onToggle,
  onChange
}: {
  id: NonNullable<OpenFilter>["id"];
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  openFilter: OpenFilter;
  colors: Record<string, string>;
  onToggle: (id: NonNullable<OpenFilter>["id"], event: ReactMouseEvent<HTMLButtonElement>) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openFilter?.id === id;
  const selectedLabel = value ? optionLabels[value] ?? value : label;

  return (
    <div className="equipment-filter-select">
      <button className="equipment-filter-trigger" type="button" onClick={(event) => onToggle(id, event)}>
        <span className={value ? "equipment-filter-value" : "property-empty"}>{selectedLabel}</span>
        <ChevronDown size={15} />
      </button>
      {isOpen && openFilter
        ? createPortal(
            <>
              <div className="equipment-select-scrim" role="presentation" onClick={() => onChange(value)} />
              <div className="tag-picker-menu equipment-filter-menu" style={{ left: openFilter.x, top: openFilter.y, width: openFilter.width }}>
                <button className="tag-option" type="button" onClick={() => onChange("")}>
                  <span className={!value ? "equipment-filter-value" : "property-empty"}>{label}</span>
                  {!value ? <Check size={15} /> : null}
                </button>
                {options.map((option) => (
                  <button className="tag-option" type="button" key={option} onClick={() => onChange(option)}>
                    <span className={value === option ? "equipment-filter-value" : "property-empty"}>{optionLabels[option] ?? option}</span>
                    {value === option ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
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
      {openSelect
        ? createPortal(
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
                  onClose();
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
            </>,
            document.body
          )
        : null}
    </div>
  );
}

async function loadRemoteEquipment(): Promise<{ equipment: EquipmentData; tags: EquipmentTagState }> {
  if (!supabase) {
    return { equipment: loadEquipmentData(), tags: loadTagState() };
  }

  const [itemsResult, tagsResult] = await Promise.all([
    supabase.from("equipment_items").select("id, name, amount, type, state, location, comment").order("created_at", { ascending: true }),
    supabase.from("equipment_tags").select("column_id, label, color").order("created_at", { ascending: true })
  ]);

  if (itemsResult.error || tagsResult.error) {
    throw new Error(itemsResult.error?.message ?? tagsResult.error?.message ?? "Equipment konnte nicht geladen werden.");
  }

  const tagState = normalizeTagState(
    (tagsResult.data ?? []).reduce<EquipmentTagState>((state, tag) => {
      const current = state[tag.column_id] ?? { options: [], colors: {} };
      current.options.push(tag.label);
      current.colors[tag.label] = tag.color;
      state[tag.column_id] = current;
      return state;
    }, {})
  );

  return {
    equipment: normalizeEquipmentData({
      columns: defaultColumns,
      rows: (itemsResult.data ?? []).map(fromEquipmentRecord)
    }),
    tags: tagState
  };
}

function fromEquipmentRecord(row: {
  id: string;
  name: string | null;
  amount: number | null;
  type: string | null;
  state: string | null;
  location: string | null;
  comment: string | null;
}): EquipmentRow {
  return {
    id: row.id,
    cells: {
      name: row.name ?? "",
      amount: String(row.amount ?? 1),
      type: row.type ?? "",
      state: row.state ?? "",
      where: row.location ?? "",
      comment: row.comment ?? ""
    }
  };
}

function toEquipmentRecord(cells: Record<string, string>) {
  return {
    name: cells.name ?? "",
    amount: Number(cells.amount ?? 1) || 1,
    type: cells.type ?? "",
    state: cells.state ?? "",
    location: cells.where ?? "",
    comment: cells.comment ?? "",
    updated_at: new Date().toISOString()
  };
}

function toEquipmentPatch(columnId: string, value: string) {
  const columnName = equipmentColumnName(columnId);
  return {
    [columnName]: columnId === "amount" ? Number(value || 0) || 0 : value,
    updated_at: new Date().toISOString()
  };
}

function equipmentColumnName(columnId: string) {
  const columns: Record<string, string> = {
    name: "name",
    amount: "amount",
    type: "type",
    state: "state",
    where: "location",
    comment: "comment"
  };
  return columns[columnId] ?? columnId;
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
