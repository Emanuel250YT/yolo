import { useState } from "react";
import { api } from "../api/client";
import { DataTable, RefCell } from "./DataTable";
import type { Session } from "../types";
import { formatRef } from "../utils/formatRef";

interface SessionsListProps {
  sessions: Session[];
  onRefresh: () => void;
}

export function SessionsList({ sessions, onRefresh }: SessionsListProps) {
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(id: string) {
    setCheckingOut(id);
    setError(null);
    try {
      await api.checkout(id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cobrar");
    } finally {
      setCheckingOut(null);
    }
  }

  function elapsed(s: Session) {
    const ms = Date.now() - new Date(s.startedAt).getTime();
    return Math.max(0, Math.round(ms / 60000));
  }

  const active = sessions.filter((s) => s.status === "active").length;
  const completed = sessions.filter((s) => s.status === "completed").length;

  return (
    <section className="panel">
      <header className="panel-head row-between">
        <div>
          <h2>Sesiones registradas</h2>
          <p>{active} activa(s) · {completed} finalizada(s)</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onRefresh}>
          Actualizar
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      <DataTable
        rows={sessions}
        rowKey={(s) => s.id}
        searchPlaceholder="Buscar por ID, patente, zona…"
        emptyMessage="No hay sesiones. Iniciá una desde Estacionar."
        filters={[
          {
            key: "status",
            label: "Estado",
            options: [
              { value: "active", label: "Activa" },
              { value: "completed", label: "Cobrada" },
            ],
          },
        ]}
        columns={[
          {
            key: "ref",
            header: "ID",
            searchValues: (s) => [s.ref, s.id, s.plate],
            render: (s) => <RefCell refId={formatRef(s)} />,
          },
          {
            key: "plate",
            header: "Patente",
            searchValues: (s) => [s.plate],
            render: (s) => <strong>{s.plate}</strong>,
          },
          {
            key: "zone",
            header: "Zona",
            searchValues: (s) => [s.zone],
            render: (s) => s.zone,
          },
          {
            key: "permit",
            header: "ID permiso",
            searchValues: (s) => [s.permitId],
            render: (s) =>
              s.permitId ? (
                <span className="meta">{s.permitId.slice(0, 8)}…</span>
              ) : (
                "—"
              ),
          },
          {
            key: "status",
            header: "Estado",
            filterKey: "status",
            searchValues: (s) => [s.status],
            render: (s) => (
              <span className="chip">
                {s.status === "active" ? "Activa" : "Cobrada"}
              </span>
            ),
          },
          {
            key: "started",
            header: "Inicio",
            render: (s) => new Date(s.startedAt).toLocaleString("es-AR"),
          },
          {
            key: "elapsed",
            header: "Tiempo",
            render: (s) =>
              s.status === "active" ? `${elapsed(s)} min` : "—",
          },
          {
            key: "checkout",
            header: "Importe",
            render: (s) =>
              s.checkout ? `$${s.checkout.net.toLocaleString("es-AR")}` : "—",
          },
          {
            key: "actions",
            header: "Acciones",
            render: (s) =>
              s.status === "active" ? (
                <button
                  type="button"
                  className="btn-small"
                  disabled={checkingOut === s.id}
                  onClick={() => checkout(s.id)}
                >
                  {checkingOut === s.id ? "Cobrando…" : "Cobrar"}
                </button>
              ) : null,
          },
        ]}
      />
    </section>
  );
}
