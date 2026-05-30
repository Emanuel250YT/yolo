import { useCallback, useEffect, useState } from "react";
import type { DashboardStats } from "../types";
import { DataTable, RefCell } from "./DataTable";
import { formatRef } from "../utils/formatRef";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maxOf(values: number[]) {
  return Math.max(1, ...values);
}

interface BarChartProps {
  items: { label: string; value: number; display?: string }[];
  formatValue?: (n: number) => string;
}

function BarChart({ items, formatValue = String }: BarChartProps) {
  const peak = maxOf(items.map((i) => i.value));
  return (
    <div className="dash-bars" role="img" aria-label="Gráfico de barras">
      {items.map((item) => (
        <div key={item.label} className="dash-bar-col">
          <div
            className="dash-bar-fill"
            style={{ height: `${Math.round((item.value / peak) * 100)}%` }}
            title={`${item.label}: ${formatValue(item.value)}`}
          />
          <span className="dash-bar-val">
            {item.display ?? formatValue(item.value)}
          </span>
          <span className="dash-bar-lbl">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function MetricRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="dash-metric">
      <span className="dash-metric-val">{value}</span>
      <span className="dash-metric-lbl">{label}</span>
      {hint && <span className="dash-metric-hint">{hint}</span>}
    </div>
  );
}

function StatusBreakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <section className="dash-card">
      <h3>{title}</h3>
      <ul className="dash-breakdown">
        {Object.entries(data).map(([key, count]) => (
          <li key={key}>
            <span className="dash-breakdown-key">{key}</span>
            <span className="dash-breakdown-bar-wrap">
              <span
                className="dash-breakdown-bar"
                style={{
                  width: `${total ? Math.round((count / total) * 100) : 0}%`,
                }}
              />
            </span>
            <span className="dash-breakdown-count">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DashboardSummaryProps {
  fetchStats: () => Promise<DashboardStats>;
  showPendingUsers?: boolean;
}

export function DashboardSummary({
  fetchStats,
  showPendingUsers = false,
}: DashboardSummaryProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await fetchStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar resumen");
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !stats) {
    return <p className="empty">Cargando resumen…</p>;
  }

  if (error && !stats) {
    return <p className="form-error banner-error">{error}</p>;
  }

  if (!stats) return null;

  const { overview, spotsByStatus } = stats;
  const occupancyPct =
    spotsByStatus.total > 0
      ? Math.round(
          ((spotsByStatus.occupied + spotsByStatus.held) /
            spotsByStatus.total) *
            100,
        )
      : 0;

  return (
    <div className="dashboard-summary">
      <header className="dash-header">
        <div>
          <h2>Resumen operativo</h2>
          <p className="dash-sub">
            Actualizado{" "}
            {new Date(stats.generatedAt).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button type="button" className="btn-small" onClick={load}>
          Actualizar
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="dash-kpi-grid">
        <MetricRow label="Usuarios" value={overview.users} />
        {showPendingUsers && stats.usersPending > 0 && (
          <MetricRow
            label="Pendientes"
            value={stats.usersPending}
            hint="Por habilitar"
          />
        )}
        <MetricRow label="Permisos" value={overview.permits} />
        <MetricRow label="Plazas" value={overview.spots} />
        <MetricRow
          label="Ocupación"
          value={`${occupancyPct}%`}
          hint={`${spotsByStatus.occupied + spotsByStatus.held} / ${spotsByStatus.total}`}
        />
        <MetricRow label="Reservas" value={overview.reservations} />
        <MetricRow
          label="Sesiones activas"
          value={stats.sessionsActive}
          hint={`${stats.sessionsCompleted} finalizadas`}
        />
        <MetricRow
          label="Ingresos hoy"
          value={fmtMoney(stats.revenueToday.total)}
          hint={`Permisos ${fmtMoney(stats.revenueToday.permits)} · Sesiones ${fmtMoney(stats.revenueToday.sessions)}`}
        />
      </div>

      <div className="dash-grid-2">
        <section className="dash-card">
          <h3>Ingresos — últimos 7 días</h3>
          <BarChart
            items={stats.revenueLast7Days.map((d) => ({
              label: fmtDate(d.date),
              value: d.amount,
              display: d.amount > 0 ? fmtMoney(d.amount) : "—",
            }))}
            formatValue={fmtMoney}
          />
        </section>

        <section className="dash-card">
          <h3>Permisos emitidos — últimos 7 días</h3>
          <BarChart
            items={stats.permitsLast7Days.map((d) => ({
              label: fmtDate(d.date),
              value: d.count,
            }))}
          />
        </section>
      </div>

      <div className="dash-grid-3">
        <section className="dash-card">
          <h3>Estado de plazas</h3>
          <ul className="dash-spot-stats">
            <li>
              <span>Disponibles</span>
              <strong>{spotsByStatus.available}</strong>
            </li>
            <li>
              <span>Ocupadas</span>
              <strong>{spotsByStatus.occupied}</strong>
            </li>
            <li>
              <span>En hold</span>
              <strong>{spotsByStatus.held}</strong>
            </li>
            <li>
              <span>Deshabilitadas</span>
              <strong>{spotsByStatus.disabled}</strong>
            </li>
          </ul>
        </section>

        <StatusBreakdown title="Permisos por estado" data={stats.permitsByStatus} />
        <StatusBreakdown
          title="Reservas por estado"
          data={stats.reservationsByStatus}
        />
      </div>

      {stats.zoneOccupancy.length > 0 && (
        <section className="dash-card">
          <h3>Ocupación por zona</h3>
          <DataTable
            rows={stats.zoneOccupancy}
            rowKey={(z) => z.zone}
            searchPlaceholder="Buscar zona…"
            emptyMessage="Sin datos de ocupación."
            columns={[
              {
                key: "name",
                header: "Zona",
                searchValues: (z) => [z.zoneName, z.zone],
                render: (z) => (
                  <>
                    <strong>{z.zoneName}</strong>
                    <span className="meta"> ({z.zone})</span>
                  </>
                ),
              },
              { key: "total", header: "Total", render: (z) => z.total },
              { key: "occupied", header: "Ocupadas", render: (z) => z.occupied },
              { key: "held", header: "Hold", render: (z) => z.held },
              { key: "available", header: "Libres", render: (z) => z.available },
              {
                key: "pct",
                header: "% Ocup.",
                searchValues: (z) => [z.occupancyPct],
                render: (z) => (
                  <div className="dash-occ-row">
                    <span
                      className="dash-occ-bar"
                      style={{ width: `${z.occupancyPct}%` }}
                    />
                    <span>{z.occupancyPct}%</span>
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}

      <div className="dash-grid-2">
        <section className="dash-card">
          <h3>Últimos permisos</h3>
          <DataTable
            rows={stats.recentPermits}
            rowKey={(p) => p.id}
            searchPlaceholder="Buscar permiso…"
            emptyMessage="Sin permisos recientes."
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (p) => [p.ref, p.id, p.plate],
                render: (p) => <RefCell refId={formatRef(p)} entityKind="permit" />,
              },
              { key: "plate", header: "Patente", render: (p) => p.plate },
              { key: "zone", header: "Zona", render: (p) => p.zone },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (p) => [p.status],
                render: (p) => <span className="chip">{p.status}</span>,
              },
              {
                key: "net",
                header: "Importe",
                render: (p) => (p.net != null ? fmtMoney(p.net) : "—"),
              },
              {
                key: "when",
                header: "Fecha",
                render: (p) => fmtDateTime(p.createdAt),
              },
            ]}
            filters={[
              {
                key: "status",
                label: "Estado",
                options: [
                  { value: "active", label: "Activo" },
                  { value: "completed", label: "Completado" },
                  { value: "cancelled", label: "Cancelado" },
                ],
              },
            ]}
          />
        </section>

        <section className="dash-card">
          <h3>Últimas reservas</h3>
          <DataTable
            rows={stats.recentReservations}
            rowKey={(r) => r.id}
            searchPlaceholder="Buscar reserva…"
            emptyMessage="Sin reservas recientes."
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (r) => [r.ref, r.id, r.plate],
                render: (r) => (
                  <RefCell refId={formatRef(r)} entityKind="reservation" />
                ),
              },
              { key: "plate", header: "Patente", render: (r) => r.plate },
              { key: "spot", header: "Plaza", render: (r) => r.spotLabel },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (r) => [r.status],
                render: (r) => <span className="chip">{r.status}</span>,
              },
              {
                key: "net",
                header: "Importe",
                render: (r) => (r.net != null ? fmtMoney(r.net) : "—"),
              },
              {
                key: "when",
                header: "Inicio",
                render: (r) => fmtDateTime(r.scheduledStart),
              },
            ]}
            filters={[
              {
                key: "status",
                label: "Estado",
                options: [
                  { value: "confirmed", label: "Confirmada" },
                  { value: "cancelled", label: "Cancelada" },
                ],
              },
            ]}
          />
        </section>
      </div>

      <section className="dash-card">
        <h3>Usuarios por rol</h3>
        <div className="dash-role-grid">
          {Object.entries(stats.usersByRole).map(([role, count]) => (
            <div key={role} className="dash-role-item">
              <span className="dash-role-count">{count}</span>
              <span className="dash-role-label">{role}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
