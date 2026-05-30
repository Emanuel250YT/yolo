import { useMemo, useState, type ReactNode } from "react";
import type { EntityKind } from "../utils/entityNav";
import { navigateToEntity } from "../utils/entityNav";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Valores usados para búsqueda global */
  searchValues?: (row: T) => (string | number | null | undefined)[];
  /** Si true, incluye la columna en filtros de estado cuando hay filterOptions */
  filterKey?: string;
}

export interface DataTableFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  filters?: DataTableFilter[];
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  toolbar?: ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin registros.",
  filters = [],
  onRowClick,
  selectedKey,
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const values = columns.flatMap((col) => col.searchValues?.(row) ?? []);
        const hit = values.some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q),
        );
        if (!hit) return false;
      }
      for (const f of filters) {
        const selected = filterValues[f.key];
        if (!selected || selected === "all") continue;
        const col = columns.find((c) => c.filterKey === f.key);
        if (!col) continue;
        const vals = col.searchValues?.(row) ?? [];
        if (!vals.some((v) => String(v) === selected)) return false;
      }
      return true;
    });
  }, [rows, search, filterValues, filters, columns]);

  return (
    <div className="data-table-panel">
      <div className="data-table-toolbar">
        <input
          type="search"
          className="data-table-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar en la tabla"
        />
        {filters.map((f) => (
          <label key={f.key} className="data-table-filter">
            <span>{f.label}</span>
            <select
              value={filterValues[f.key] ?? "all"}
              onChange={(e) =>
                setFilterValues((prev) => ({
                  ...prev,
                  [f.key]: e.target.value,
                }))
              }
            >
              <option value="all">Todos</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {toolbar}
        <span className="data-table-count">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const key = rowKey(row);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  className={`${onRowClick ? "row-clickable" : ""}${selected ? " row-selected" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TableActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="table-actions"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {children}
    </div>
  );
}

export function RefCell({
  refId,
  title,
  entityKind,
}: {
  refId: string;
  title?: string;
  entityKind?: EntityKind;
}) {
  if (entityKind) {
    return (
      <button
        type="button"
        className="ref-cell ref-cell--link"
        title={title ?? refId}
        onClick={(e) => {
          e.stopPropagation();
          navigateToEntity(entityKind, refId);
        }}
      >
        {refId}
      </button>
    );
  }
  return (
    <code className="ref-cell" title={title ?? refId}>
      {refId}
    </code>
  );
}

export function LinkedRef({
  label,
  refId,
  entityKind,
}: {
  label: string;
  refId: string | null | undefined;
  entityKind?: EntityKind;
}) {
  if (!refId) return <span className="meta">—</span>;
  return (
    <span className="linked-ref" title={label}>
      <span className="linked-ref-lbl">{label}</span>
      <RefCell refId={refId} entityKind={entityKind} />
    </span>
  );
}
