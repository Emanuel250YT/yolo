import { useDevTools } from "../dev/DevToolsContext";
import { getDevNowMs } from "../dev/devConfig";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, unwrapPaginated } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AccountProfilePanel } from "../components/AccountProfilePanel";
import { AppShell } from "../components/AppShell";
import { DataTable, RefCell, TableActions } from "../components/DataTable";
import { ConductorPayByCodeForm } from "../components/PaymentOrderDisplay";
import { usePaginatedTable } from "../hooks/usePaginatedTable";
import { ParkingAlertsBanner } from "../components/ParkingAlertsBanner";
import { PermitSpotPicker } from "../components/PermitSpotPicker";
import { ZonesMap } from "../components/ZonesMap";
import { useGeolocation } from "../hooks/useGeolocation";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { spotLiveStatus } from "../utils/geo";
import { zoneLabel } from "../utils/zoneDefaults";
import { formatRef } from "../utils/formatRef";
import {
  buildReservationStartSlots,
  defaultStartSlot,
  RESERVATION_HOUR_OPTIONS,
} from "../utils/reservationSchedule";
import type {
  ConductorVehicle,
  ParkingAlert,
  ParkingZone,
  Permit,
  PricingBreakdown,
  QuoteResult,
  Reservation,
  Spot,
  Tariffs,
} from "../types";

const NAV = [
  { id: "inicio", label: "Inicio" },
  { id: "vehiculos", label: "Vehículos" },
  { id: "permisos", label: "Permisos" },
  { id: "lugares", label: "Lugares" },
  { id: "reservar", label: "Reservar" },
  { id: "mis-reservas", label: "Reservas" },
  { id: "pagar", label: "Pagar" },
  { id: "cuenta", label: "Mi cuenta" },
];

const PERMIT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  grace: "En tolerancia",
  completed: "Completado",
  cancelled: "Cancelado",
};

function formatGraceRemaining(graceUntil: string | null | undefined) {
  if (!graceUntil) return null;
  const ms = new Date(graceUntil).getTime() - getDevNowMs();
  if (ms <= 0) return "Venció la tolerancia";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")} restantes`;
}

function formatDurationHours(minutes: number) {
  const h = minutes / 60;
  return h === 1 ? "1 hora" : `${h} horas`;
}

function spotAvailable(s: Spot) {
  const st = s.status ?? spotLiveStatus(s);
  return st === "available";
}

function spotStatusLabel(s: Spot) {
  const st = s.status ?? spotLiveStatus(s);
  if (st === "available") return "Libre";
  if (st === "held") return s.heldByMe ? "Tu reserva" : "Reservada";
  if (st === "occupied") return "Ocupada";
  return "No disponible";
}

export function ConductorDashboard() {
  const { refreshKey } = useDevTools();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("inicio");
  const [spots, setSpots] = useState<Spot[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [reservationVehicles, setReservationVehicles] = useState<
    ConductorVehicle[]
  >([]);
  const [hasVehicles, setHasVehicles] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [alerts, setAlerts] = useState<ParkingAlert[]>([]);
  const [tariffs, setTariffs] = useState<Tariffs | null>(null);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [holdPaymentMinutesMp, setHoldPaymentMinutesMp] = useState(5);
  const [mapZone, setMapZone] = useState<string | null>(null);
  const [reserveZone, setReserveZone] = useState<string>("");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [cashQuote, setCashQuote] = useState<QuoteResult | null>(null);
  const [slotTick, setSlotTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [payCodeError, setPayCodeError] = useState<string | null>(null);
  const { busy: payCodeLoading, run: runPayCode } = useSubmitLock();

  const geo = useGeolocation(tab === "lugares");

  const {
    items: vehicles,
    serverPagination: vehiclesPagination,
    refresh: refreshVehicles,
  } = usePaginatedTable<ConductorVehicle>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "vehicles",
        await api.conductorVehicles({
          page,
          pageSize,
          q,
          source: filters.source,
        }),
      ),
    enabled: tab === "vehiculos",
  });

  const {
    items: reservations,
    serverPagination: reservationsPagination,
    refresh: refreshReservations,
  } = usePaginatedTable<Reservation>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "reservations",
        await api.reservations({
          page,
          pageSize,
          q,
          status: filters.status,
        }),
      ),
    enabled: tab === "mis-reservas",
  });

  const {
    items: permits,
    serverPagination: permitsPagination,
    refresh: refreshPermits,
  } = usePaginatedTable<Permit>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "permits",
        await api.conductorPermits({
          page,
          pageSize,
          q,
          status: filters.status,
        }),
      ),
    enabled: tab === "permisos",
    resetKey: refreshKey,
  });

  const [vehicleForm, setVehicleForm] = useState({
    plate: "",
    vehicleType: "auto" as "auto" | "motorcycle",
    label: "",
  });

  const [form, setForm] = useState({
    plate: "",
    vehicleType: "auto" as "auto" | "motorcycle",
    scheduledStart: defaultStartSlot(),
    durationHours: 1,
  });

  const { busy: reserving, run: runReserve } = useSubmitLock();
  const { busy: payingPermit, run: runPayPermit } = useSubmitLock();
  const { busy: addingVehicle, run: runAddVehicle } = useSubmitLock();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const startSlots = useMemo(
    () => buildReservationStartSlots(maxAdvance),
    [maxAdvance, slotTick, refreshKey],
  );

  const enabledZones = useMemo(
    () => zones.filter((z) => z.enabled),
    [zones],
  );

  const filteredSpots = useMemo(
    () => (mapZone ? spots.filter((s) => s.zone === mapZone) : spots),
    [spots, mapZone],
  );

  const selectedVehicle = useMemo(
    () => reservationVehicles.find((v) => v.plate === form.plate) ?? null,
    [reservationVehicles, form.plate],
  );

  const isFreeSpot = selectedSpot?.spotType === "gratuita";

  const ratePerHour =
    tariffs == null
      ? null
      : form.vehicleType === "motorcycle"
        ? tariffs.motorcyclePerHour
        : tariffs.autoPerHour;

  const refreshLiveSpots = useCallback(async () => {
    try {
      const zoneFilter = tab === "lugares" && mapZone ? mapZone : undefined;
      const { spots: live } = await api.spotsLive(
        zoneFilter ? { zone: zoneFilter } : undefined,
      );
      setSpots(live);
    } catch {
      /* ignore polling errors */
    }
  }, [tab, mapZone]);

  const load = useCallback(async () => {
    try {
      const [s, c, v, a, z, t] = await Promise.all([
        api.spotsLive(),
        api.conductorConfig(),
        api.conductorVehicles({ page: 1, pageSize: 100 }),
        api.conductorParkingAlerts(),
        api.parkingZones({ pageSize: 100 }),
        api.tariffs(),
      ]);
      setSpots(s.spots);
      setMaxAdvance(c.maxAdvanceMinutes);
      setHoldPaymentMinutesMp(c.holdPaymentMinutesMp ?? 5);
      setHasVehicles(v.total > 0);
      setVehicleCount(v.total);
      setReservationVehicles(v.vehicles);
      setAlerts(a.alerts);
      setZones(z.zones);
      setTariffs(t.tariffs);
      const firstVehicle = v.vehicles[0];
      const firstZone = z.zones.find((zone) => zone.enabled);
      setForm((f) => ({
        ...f,
        plate: f.plate || firstVehicle?.plate || "",
        vehicleType: firstVehicle?.vehicleType ?? f.vehicleType,
        scheduledStart: defaultStartSlot(c.maxAdvanceMinutes),
      }));
      setReserveZone((prev) => prev || firstZone?.code || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      api.conductorParkingAlerts().then((r) => setAlerts(r.alerts)).catch(() => null);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (tab !== "reservar") return;
    const id = window.setInterval(() => setSlotTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [tab]);

  useEffect(() => {
    if (tab !== "inicio" && tab !== "lugares") return;
    refreshLiveSpots();
    const id = window.setInterval(() => {
      refreshLiveSpots();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [tab, refreshLiveSpots, refreshKey]);

  useEffect(() => {
    setSelectedSpotId(null);
    setSelectedSpot(null);
  }, [reserveZone]);

  useEffect(() => {
    if (tab !== "reservar") return;
    api
      .conductorVehicles({ page: 1, pageSize: 100 })
      .then((v) => {
        setReservationVehicles(v.vehicles);
        setHasVehicles(v.total > 0);
        setVehicleCount(v.total);
      })
      .catch(() => null);
  }, [tab, refreshKey]);

  const reservationMinutes = form.durationHours * 60;

  useEffect(() => {
    if (tab !== "reservar" || !form.plate) {
      setCashQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (isFreeSpot && tariffs) {
          setCashQuote({
            plate: form.plate,
            vehicleType: form.vehicleType,
            minutes: reservationMinutes,
            gross: 0,
            digitalDiscount: 0,
            net: 0,
            digitalPayment: false,
            rules: {
              toleranceMinutes: tariffs.toleranceMinutes,
              digitalDiscountRate: tariffs.digitalDiscountRate,
              fractionMinutes: tariffs.fractionMinutes,
              fractionFromHour: tariffs.fractionFromHour,
            },
          });
          return;
        }
        const quote = await api.quote({
          vehicleType: form.vehicleType,
          minutes: reservationMinutes,
          digitalPayment: false,
          plate: form.plate,
        });
        if (!cancelled) setCashQuote(quote);
      } catch {
        if (!cancelled) setCashQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    form.plate,
    form.vehicleType,
    reservationMinutes,
    isFreeSpot,
    tariffs,
    refreshKey,
  ]);

  useEffect(() => {
    if (!startSlots.some((s) => s.value === form.scheduledStart)) {
      setForm((f) => ({
        ...f,
        scheduledStart: startSlots[0]?.value ?? defaultStartSlot(maxAdvance),
      }));
    }
  }, [startSlots, form.scheduledStart, maxAdvance]);

  function goRenew(plate: string) {
    setForm((f) => ({ ...f, plate }));
    setTab("reservar");
  }

  async function reserveAndPay() {
    if (!selectedVehicle) {
      setError("Seleccioná un vehículo registrado.");
      return;
    }
    if (!reserveZone) {
      setError("Seleccioná una zona.");
      return;
    }
    if (!selectedSpotId) {
      setError("Seleccioná una plaza libre para el vehículo.");
      return;
    }
    if (isFreeSpot) {
      setError(
        "Las plazas gratuitas no se reservan con Mercado Pago. Elegí una plaza de pago.",
      );
      return;
    }

    await runReserve(async () => {
      setError(null);
      const start = new Date(form.scheduledStart).getTime();
      const limit = getDevNowMs() + maxAdvance * 60 * 1000;
      if (start > limit) {
        setError(`Solo podés reservar hasta ${maxAdvance} minutos adelante.`);
        return;
      }
      try {
        const { hold } = await api.createSpotHold(selectedSpotId, {
          plate: selectedVehicle.plate,
          vehicleType: selectedVehicle.vehicleType,
          scheduledStart: form.scheduledStart,
          durationHours: form.durationHours,
          digitalPayment: false,
        });
        const res = await api.paySpotHold(hold.id, "mercadopago");
        if (res.payment?.orderId) {
          navigate(
            `/payment-brick?order-id=${encodeURIComponent(res.payment.orderId)}`,
          );
          return;
        }
        setSelectedSpotId(null);
        setSelectedSpot(null);
        await load();
        setTab("mis-reservas");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al reservar");
      }
    });
  }

  async function payPermitPending(permit: Permit) {
    await runPayPermit(async () => {
      setError(null);
      try {
        const { payment } = await api.conductorPermitPayment(permit.id);
        if (!payment?.orderId) {
          setError("No hay un pago pendiente para este permiso.");
          return;
        }
        navigate(
          `/payment-brick?order-id=${encodeURIComponent(payment.orderId)}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al obtener el pago");
      }
    });
  }

  async function payWithOrderCode(orderId: string) {
    await runPayCode(async () => {
      setPayCodeError(null);
      try {
        const res = await api.getPaymentOrder(orderId);
        if (res.order.status === "paid") {
          setPayCodeError("Esta orden ya fue pagada.");
          return;
        }
        if (res.order.status !== "pending") {
          setPayCodeError("Esta orden ya no está disponible para pago.");
          return;
        }
        navigate(`/payment-brick?order-id=${encodeURIComponent(orderId)}`);
      } catch {
        setPayCodeError("Código no encontrado. Verificá e intentá de nuevo.");
      }
    });
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    await runAddVehicle(async () => {
      setError(null);
      try {
        await api.conductorAddVehicle(vehicleForm);
        setVehicleForm({ plate: "", vehicleType: "auto", label: "" });
        await refreshVehicles();
        const v = await api.conductorVehicles({ page: 1, pageSize: 100 });
        setReservationVehicles(v.vehicles);
        setHasVehicles(v.total > 0);
        setVehicleCount(v.total);
        if (!form.plate && v.vehicles[0]) {
          setForm((f) => ({
            ...f,
            plate: v.vehicles[0].plate,
            vehicleType: v.vehicles[0].vehicleType,
          }));
        }
        setTab("vehiculos");
        void refreshPermits();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  async function removeVehicle(id: string) {
    if (pendingId) return;
    setPendingId(id);
    try {
      await api.conductorDeleteVehicle(id);
      await refreshVehicles();
      const v = await api.conductorVehicles({ page: 1, pageSize: 100 });
      setReservationVehicles(v.vehicles);
      setVehicleCount(v.total);
      setHasVehicles(v.total > 0);
      if (form.plate && !v.vehicles.some((veh) => veh.plate === form.plate)) {
        const next = v.vehicles[0];
        setForm((f) => ({
          ...f,
          plate: next?.plate ?? "",
          vehicleType: next?.vehicleType ?? "auto",
        }));
      }
      void refreshPermits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPendingId(null);
    }
  }

  async function cancelReservation(id: string) {
    if (pendingId) return;
    setPendingId(id);
    try {
      await api.cancelReservation(id);
      await refreshReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell
      title="Conductor"
      subtitle="Vehículos, estacionamiento y reservas"
      nav={NAV}
      tab={tab}
      onTab={setTab}
      mobileDock={{
        left: {
          tabId: "lugares",
          label: "Plazas y vencimientos",
          badge: alerts.length,
        },
        center: { tabId: "reservar", label: "Reservar" },
        right: { action: "menu", label: "Mi perfil" },
      }}
    >
      {error && <p className="form-error banner-error">{error}</p>}

      {(tab === "inicio" || tab === "vehiculos" || tab === "reservar" || tab === "permisos") && (
        <ParkingAlertsBanner alerts={alerts} onRenew={goRenew} />
      )}

      {tab === "inicio" && (
        <section className="panel">
          <h2>Resumen</h2>
          <p className="panel-desc">
            Registrá tus vehículos para recibir avisos cuando haya un permiso de
            estacionamiento activo con tu patente. Reservá en la zona que elijas
            y pagá con Mercado Pago en {holdPaymentMinutesMp} minutos.
          </p>
          <ZonesMap onZoneSelect={setMapZone} selectedZone={mapZone} />
          <div className="stat-grid">
            <article className="stat-card">
              <span className="stat-val">{vehicleCount}</span>
              <span className="stat-lbl">Vehículos</span>
            </article>
            <article className="stat-card">
              <span className="stat-val">{alerts.length}</span>
              <span className="stat-lbl">Estacionamientos activos</span>
            </article>
            <article className="stat-card">
              <span className="stat-val">
                {spots.filter(spotAvailable).length}
              </span>
              <span className="stat-lbl">Plazas libres</span>
            </article>
          </div>
          <div className="panel-actions">
            <button type="button" className="btn-mp" onClick={() => setTab("pagar")}>
              Pagar con código de orden
            </button>
          </div>
        </section>
      )}

      {tab === "vehiculos" && (
        <div className="split-panel">
          <section className="panel">
            <h2>Mis vehículos ({vehiclesPagination.total})</h2>
            <p className="panel-desc">
              Patentes registradas manualmente o desde el padrón municipal
              (automático).
            </p>
            <DataTable
              rows={vehicles}
              rowKey={(v) => v.id}
              searchPlaceholder="Buscar patente…"
              emptyMessage="Todavía no registraste vehículos."
              serverPagination={vehiclesPagination}
              filters={[
                {
                  key: "source",
                  label: "Origen",
                  options: [
                    { value: "gov", label: "Padrón municipal" },
                    { value: "manual", label: "Manual" },
                  ],
                },
              ]}
              columns={[
                {
                  key: "plate",
                  header: "Patente",
                  searchValues: (v) => [v.plate, v.label],
                  render: (v) => <strong>{v.plate}</strong>,
                },
                {
                  key: "type",
                  header: "Tipo",
                  searchValues: (v) => [v.vehicleType],
                  render: (v) =>
                    v.vehicleType === "motorcycle" ? "Motocicleta" : "Automóvil",
                },
                {
                  key: "source",
                  header: "Origen",
                  filterKey: "source",
                  searchValues: (v) => [v.source],
                  render: (v) => (
                    <span className="chip">
                      {v.source === "gov" ? "Padrón municipal" : "Manual"}
                    </span>
                  ),
                },
                {
                  key: "label",
                  header: "Etiqueta",
                  searchValues: (v) => [v.label],
                  render: (v) => v.label ?? "—",
                },
                {
                  key: "actions",
                  header: "Acciones",
                  render: (v) =>
                    v.source === "manual" ? (
                      <TableActions>
                        <button
                          type="button"
                          className="btn-small btn-danger"
                          disabled={!!pendingId}
                          onClick={() => removeVehicle(v.id)}
                        >
                          Quitar
                        </button>
                      </TableActions>
                    ) : (
                      <span className="meta">—</span>
                    ),
                },
              ]}
            />
          </section>

          <section className="panel">
            <h2>Registrar vehículo</h2>
            <form className="form-standard" onSubmit={addVehicle}>
              <div className="field">
                <label>Patente *</label>
                <input
                  required
                  value={vehicleForm.plate}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      plate: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select
                  value={vehicleForm.vehicleType}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      vehicleType: e.target.value as "auto" | "motorcycle",
                    })
                  }
                >
                  <option value="auto">Automóvil</option>
                  <option value="motorcycle">Motocicleta</option>
                </select>
              </div>
              <div className="field">
                <label>Alias (opcional)</label>
                <input
                  value={vehicleForm.label}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, label: e.target.value })
                  }
                  placeholder="Ej. Auto familiar"
                />
              </div>
              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={addingVehicle}
              >
                {addingVehicle ? "Registrando…" : "Agregar vehículo"}
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === "permisos" && (
        <section className="panel">
          <h2>Mis permisos</h2>
          <p className="panel-desc">
            Permisos de estacionamiento asociados a las patentes de tus
            vehículos registrados (padron o manual).
          </p>
          {!hasVehicles && (
            <p className="form-error">
              Registrá vehículos en la pestaña Vehículos para ver permisos
              vinculados a tus patentes.
            </p>
          )}
          <DataTable
            rows={permits}
            rowKey={(p) => p.id}
            searchPlaceholder="Buscar por ID, patente, zona…"
            emptyMessage={
              hasVehicles
                ? "No hay permisos para tus vehículos."
                : "Agregá vehículos para ver permisos."
            }
            serverPagination={permitsPagination}
            filters={[
              {
                key: "status",
                label: "Estado",
                options: [
                  { value: "active", label: "Activo" },
                  { value: "grace", label: "En tolerancia" },
                  { value: "completed", label: "Completado" },
                  { value: "cancelled", label: "Cancelado" },
                ],
              },
            ]}
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (p) => [p.ref, p.id, p.plate],
                render: (p) => (
                  <RefCell refId={formatRef(p)} entityKind="permit" />
                ),
              },
              {
                key: "plate",
                header: "Patente",
                searchValues: (p) => [p.plate],
                render: (p) => <strong>{p.plate}</strong>,
              },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (p) => [p.status],
                render: (p) => (
                  <span
                    className={`chip${p.status === "grace" ? " chip-warn" : ""}`}
                  >
                    {PERMIT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                ),
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (p) => [p.zone, zoneLabel(p.zone, zones)],
                render: (p) => zoneLabel(p.zone, zones),
              },
              {
                key: "spot",
                header: "Plaza",
                searchValues: (p) => [p.spotLabel],
                render: (p) => p.spotLabel ?? "—",
              },
              {
                key: "payment",
                header: "Pago",
                render: (p) =>
                  p.paymentMethod === "mercadopago"
                    ? p.paidAt
                      ? "MP ✓"
                      : "MP pend."
                    : p.paymentMethod === "cash"
                      ? "Efectivo"
                      : "—",
              },
              {
                key: "net",
                header: "Importe",
                render: (p) =>
                  p.pricing
                    ? `$${(p.pricing as PricingBreakdown).net.toLocaleString("es-AR")}`
                    : "—",
              },
              {
                key: "grace",
                header: "Tolerancia",
                render: (p) =>
                  p.status === "grace" && p.graceUntil
                    ? formatGraceRemaining(p.graceUntil)
                    : "—",
              },
              {
                key: "end",
                header: "Vence",
                searchValues: (p) => [p.endAt],
                render: (p) =>
                  p.endAt
                    ? new Date(p.endAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—",
              },
              {
                key: "actions",
                header: "Acciones",
                render: (p) =>
                  p.paymentMethod === "mercadopago" &&
                  !p.paidAt &&
                  (p.status === "active" || p.status === "grace") ? (
                    <TableActions>
                      <button
                        type="button"
                        className="btn-small btn-mp"
                        disabled={payingPermit}
                        onClick={() => void payPermitPending(p)}
                      >
                        Pagar
                      </button>
                    </TableActions>
                  ) : null,
              },
            ]}
          />
        </section>
      )}

      {tab === "lugares" && (
        <section className="panel">
          <ParkingAlertsBanner alerts={alerts} onRenew={goRenew} />
          <h2>Plazas en tiempo real</h2>
          <p className="panel-desc">
            Mapa de calor por ocupación. Actualización cada 5 segundos.
            {geo.lat != null && " Cuadras ordenadas por cercanía a tu ubicación."}
          </p>
          {geo.error && <p className="info-inline">{geo.error}</p>}
          <ZonesMap
            spots={spots}
            selectedZone={mapZone}
            onZoneSelect={(z) => setMapZone((prev) => (prev === z ? null : z))}
            height={420}
          />
          <div className="spots-grid">
            {filteredSpots.map((s) => {
              const st = s.status ?? spotLiveStatus(s);
              return (
                <article
                  key={s.id}
                  className={`spot-card status-${st}`}
                >
                  <h3>{s.label}</h3>
                  <p className="meta">
                    {s.blockStreet || s.address}
                    {s.region ? ` · ${s.region}` : ""}
                  </p>
                  <p>
                    <span className="chip">{s.zone}</span>
                    <span
                      className={`chip${s.spotType === "gratuita" ? " chip--free" : ""}`}
                    >
                      {s.spotType === "gratuita" ? "Gratuita" : "Pago"}
                    </span>
                    <span className={`chip status-chip status-${st}`}>
                      {spotStatusLabel(s)}
                    </span>
                  </p>
                </article>
              );
            })}
            {filteredSpots.length === 0 && (
              <p className="empty">No hay plazas en esta zona.</p>
            )}
          </div>
        </section>
      )}

      {tab === "reservar" && (
        <section className="panel">
          <h2>Reservar plaza</h2>
          <p className="panel-desc">
            Elegí zona, vehículo y horario. Se asigna automáticamente la plaza
            más cercana; podés cambiarla si querés. El cobro se realiza con
            Mercado Pago del permisionario de la zona ({holdPaymentMinutesMp}{" "}
            min para completar el pago). Inicio hasta {maxAdvance} minutos
            adelante.
          </p>

          {!hasVehicles && (
            <p className="form-error">
              Registrá al menos un vehículo en la pestaña Vehículos antes de
              reservar.
            </p>
          )}

          {tariffs && ratePerHour != null && form.plate && (
            <div className="permit-summary-card">
              <div className="permit-summary-row">
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Conductor</span>
                  <strong>{user?.name ?? "—"}</strong>
                  <span className="permit-summary-meta">
                    {selectedVehicle?.plate ?? form.plate}
                    {selectedVehicle?.label
                      ? ` · ${selectedVehicle.label}`
                      : ""}
                  </span>
                </div>
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Zona</span>
                  <strong>
                    {zoneLabel(reserveZone, zones) || "Sin seleccionar"}
                  </strong>
                </div>
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Tarifa vigente</span>
                  <strong>${ratePerHour.toLocaleString("es-AR")}/h</strong>
                  <span className="permit-summary-meta">
                    {form.vehicleType === "motorcycle"
                      ? "Motocicleta"
                      : "Automóvil"}{" "}
                    · {form.durationHours}{" "}
                    {form.durationHours === 1 ? "hora" : "horas"}
                  </span>
                </div>
                {cashQuote && (
                  <div className="permit-summary-item permit-summary-cobro">
                    <span className="permit-summary-label">Cobro estimado</span>
                    <strong className="permit-summary-amount">
                      ${cashQuote.net.toLocaleString("es-AR")}
                    </strong>
                    <span className="permit-summary-meta">
                      {isFreeSpot
                        ? "Plaza gratuita · no aplica Mercado Pago"
                        : "Mercado Pago · permisionario de la zona"}
                    </span>
                  </div>
                )}
              </div>
              <p className="permit-summary-foot">
                Tolerancia {tariffs.toleranceMinutes} min · Fracción{" "}
                {tariffs.fractionMinutes} min
              </p>
            </div>
          )}

          <div className="form-grid reserve-filters">
            <label>
              Zona *
              <select
                required
                value={reserveZone}
                onChange={(e) => setReserveZone(e.target.value)}
              >
                <option value="" disabled>
                  Seleccionar zona
                </option>
                {enabledZones.map((z) => (
                  <option key={z.id} value={z.code}>
                    {z.name} ({z.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vehículo *
              <select
                required
                value={form.plate}
                disabled={!hasVehicles}
                onChange={(e) => {
                  const plate = e.target.value;
                  const vehicle = reservationVehicles.find(
                    (v) => v.plate === plate,
                  );
                  setForm({
                    ...form,
                    plate,
                    vehicleType: vehicle?.vehicleType ?? "auto",
                  });
                }}
              >
                <option value="" disabled>
                  Seleccionar vehículo
                </option>
                {reservationVehicles.map((v) => (
                  <option key={v.id} value={v.plate}>
                    {v.plate}
                    {v.label ? ` · ${v.label}` : ""}
                    {" · "}
                    {v.vehicleType === "motorcycle" ? "Moto" : "Auto"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Horario de inicio *
              <select
                required
                value={form.scheduledStart}
                onChange={(e) =>
                  setForm({ ...form, scheduledStart: e.target.value })
                }
              >
                {startSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duración *
              <select
                value={form.durationHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationHours: Number(e.target.value),
                  })
                }
              >
                {RESERVATION_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hora" : "horas"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {reserveZone && (
            <PermitSpotPicker
              zoneCode={reserveZone}
              zones={enabledZones}
              selectedSpotId={selectedSpotId}
              onSpotChange={(id, spot) => {
                setSelectedSpotId(id);
                setSelectedSpot(spot);
              }}
              disabled={reserving || !hasVehicles}
              audience="conductor"
            />
          )}

          <div className="action-buttons permit-pay-actions">
            <button
              type="button"
              className="btn-mp"
              disabled={
                reserving ||
                !hasVehicles ||
                !form.plate ||
                !selectedSpotId ||
                isFreeSpot ||
                !cashQuote ||
                cashQuote.net <= 0
              }
              onClick={() => void reserveAndPay()}
            >
              {reserving
                ? "Generando pago…"
                : cashQuote
                  ? `Mercado Pago · $${cashQuote.net.toLocaleString("es-AR")}`
                  : "Mercado Pago"}
            </button>
          </div>
          {isFreeSpot && (
            <p className="info-inline">
              Las plazas gratuitas no se reservan con Mercado Pago. Elegí una
              plaza de pago o cambiá de zona.
            </p>
          )}
        </section>
      )}

      {tab === "mis-reservas" && (
        <section className="panel">
          <h2>Mis reservas</h2>
          <DataTable
            rows={reservations}
            rowKey={(r) => r.id}
            searchPlaceholder="Buscar por patente, plaza…"
            emptyMessage="No tenés reservas."
            serverPagination={reservationsPagination}
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
            columns={[
              {
                key: "plate",
                header: "Patente",
                searchValues: (r) => [r.plate, r.spotLabel],
                render: (r) => <strong>{r.plate}</strong>,
              },
              {
                key: "spot",
                header: "Plaza",
                searchValues: (r) => [r.spotLabel, r.zone],
                render: (r) => r.spotLabel,
              },
              {
                key: "amount",
                header: "Importe",
                render: (r) => `$${r.pricing.net.toLocaleString("es-AR")}`,
              },
              {
                key: "duration",
                header: "Duración",
                render: (r) => formatDurationHours(r.durationMinutes),
              },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (r) => [r.status],
                render: (r) => r.status,
              },
              {
                key: "when",
                header: "Inicio",
                render: (r) =>
                  new Date(r.scheduledStart).toLocaleString("es-AR"),
              },
              {
                key: "actions",
                header: "Acciones",
                render: (r) =>
                  r.status === "confirmed" ? (
                    <TableActions>
                      <button
                        type="button"
                        className="btn-small btn-danger"
                        disabled={!!pendingId}
                        onClick={() => cancelReservation(r.id)}
                      >
                        Cancelar
                      </button>
                    </TableActions>
                  ) : null,
              },
            ]}
          />
        </section>
      )}

      {tab === "pagar" && (
        <section className="panel payment-code-panel">
          <h2>Pagar con código</h2>
          <p className="panel-desc">
            Si el permisionario te dio un código de pago, ingresalo acá para
            completar el cobro con Mercado Pago.
          </p>
          <ConductorPayByCodeForm
            onSubmit={(code) => void payWithOrderCode(code)}
            loading={payCodeLoading}
            error={payCodeError}
          />
        </section>
      )}

      {tab === "cuenta" && <AccountProfilePanel />}
    </AppShell>
  );
}
