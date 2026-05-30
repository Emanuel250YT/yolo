import { DataTable, RefCell, type DataTableFilter } from "./DataTable";
import type { HistoryEntry } from "../types";
import type { ServerPaginationProps } from "../hooks/usePaginatedTable";

const ACTION_LABELS: Record<string, string> = {
  create: "Alta",
  update: "Modificación",
  delete: "Eliminación",
  observation: "Observación",
  activate: "Activación",
  deactivate: "Desactivación",
};

const ENTITY_LABELS: Record<string, string> = {
  permit: "Permiso",
  zone: "Zona",
  spot: "Plaza",
  user: "Usuario",
  reservation: "Reserva",
  session: "Sesión",
  tariff: "Tarifa",
};

interface HistoryTableProps {
  rows: HistoryEntry[];
  showActor?: boolean;
  searchPlaceholder?: string;
  serverPagination?: ServerPaginationProps;
}

export function HistoryTable({
  rows,
  showActor = true,
  searchPlaceholder = "Buscar en historial…",
  serverPagination,
}: HistoryTableProps) {
  const filters: DataTableFilter[] = [
    {
      key: "action",
      label: "Acción",
      options: Object.entries(ACTION_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      key: "entityType",
      label: "Tipo",
      options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ];

  return (
    <DataTable
      rows={rows}
      rowKey={(h) => h.id}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="Sin registros en el historial."
      serverPagination={serverPagination}
      filters={filters}
      columns={[
        {
          key: "when",
          header: "Fecha",
          searchValues: (h) => [h.createdAt],
          render: (h) =>
            new Date(h.createdAt).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
        },
        {
          key: "action",
          header: "Acción",
          filterKey: "action",
          searchValues: (h) => [h.action, ACTION_LABELS[h.action]],
          render: (h) => (
            <span className={`chip hist-action ${h.action}`}>
              {ACTION_LABELS[h.action] ?? h.action}
            </span>
          ),
        },
        {
          key: "entity",
          header: "Elemento",
          filterKey: "entityType",
          searchValues: (h) => [
            h.entityType,
            h.entityLabel,
            h.entityRef,
            h.entityId,
          ],
          render: (h) => (
            <span>
              {h.entityType ? (
                <span className="meta">
                  {ENTITY_LABELS[h.entityType] ?? h.entityType}:{" "}
                </span>
              ) : null}
              {h.entityRef ? (
                <RefCell refId={h.entityRef} />
              ) : (
                h.entityLabel ?? "—"
              )}
            </span>
          ),
        },
        ...(showActor
          ? [
              {
                key: "user",
                header: "Usuario",
                searchValues: (h: HistoryEntry) => [h.userName, h.userId],
                render: (h: HistoryEntry) => h.userName,
              },
            ]
          : []),
        {
          key: "detail",
          header: "Detalle",
          searchValues: (h) => [h.observation, JSON.stringify(h.after ?? "")],
          render: (h) => (
            <span className="meta">
              {h.observation ||
                (h.after && typeof h.after === "object"
                  ? JSON.stringify(h.after).slice(0, 120)
                  : "—")}
            </span>
          ),
        },
      ]}
    />
  );
}
