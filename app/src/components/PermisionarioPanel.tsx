import { useCallback, useEffect, useMemo, useState } from "react";
import { getDevNowMs } from "../dev/devConfig";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { api, unwrapPaginated } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useDevTools } from "../dev/DevToolsContext";
import { usePaginatedTable } from "../hooks/usePaginatedTable";
import { useGeolocation } from "../hooks/useGeolocation";
import { useToast } from "./Toast";
import { DataTable, RefCell, TableActions } from "./DataTable";
import { HistoryTable } from "./HistoryTable";
import { OutOfHoursNotice } from "./OutOfHoursNotice";
import { PermisionarioSpotPanel } from "./PermisionarioSpotPanel";
import { PermitSpotPicker } from "./PermitSpotPicker";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { PaymentOrderDisplay } from "./PaymentOrderDisplay";
import { PriceCard } from "./PriceCard";
import { SearchableSelect } from "./SearchableSelect";
import { ShiftBanner } from "./ShiftBanner";
import { ZonesMap } from "./ZonesMap";
import {
  zoneCodeForUser,
  zoneLabel,
  zoneOptionsForPermit,
} from "../utils/zoneDefaults";
import { zoneCodeOptions } from "../utils/selectOptions";
import { formatRef } from "../utils/formatRef";
import type { EntityNavTarget } from "../utils/entityNav";
import type {
  HistoryEntry,
  ParkingZone,
  PaymentOrderInfo,
  Permit,
  PricingBreakdown,
  QuoteResult,
  Spot,
  Tariffs,
  UserRole,
} from "../types";

interface PermisionarioPanelProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  navTarget?: EntityNavTarget | null;
  onNavHandled?: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  municipio: "Municipalidad",
  admin: "Administrador",
  permisionario: "Permisionario",
  conductor: "Conductor",
};

const HOUR_OPTIONS = Array.from({ length: 23 }, (_, i) => i + 1);

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

function permitDeadlineIso(permit: Permit) {
  if (permit.status === "grace" && permit.graceUntil) return permit.graceUntil;
  return permit.endAt;
}

function formatControlRemaining(iso: string | null | undefined) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - getDevNowMs();
  if (ms <= 0) return "Vencido";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function remainingMs(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return new Date(iso).getTime() - getDevNowMs();
}

export function PermisionarioPanel({
  activeTab,
  onTabChange,
  navTarget,
  onNavHandled,
}: PermisionarioPanelProps) {
  const { user } = useAuth();
  const { refreshKey } = useDevTools();
  const toast = useToast();
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [tariffs, setTariffs] = useState<Tariffs | null>(null);
  const [shift, setShift] = useState<Awaited<
    ReturnType<typeof api.shiftStatus>
  > | null>(null);
  const [selected, setSelected] = useState<Permit | null>(null);
  const [observation, setObservation] = useState("");
  const { busy: submitting, run: runSubmit } = useSubmitLock();
  const { busy: savingObs, run: runObs } = useSubmitLock();

  const {
    items: permits,
    serverPagination: permitsPagination,
    refresh: refreshPermits,
  } = usePaginatedTable<Permit>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "permits",
        await api.permits({ page, pageSize, q, status: filters.status }),
      ),
    enabled: activeTab === "permisos",
    resetKey: refreshKey,
  });

  const {
    items: history,
    serverPagination: historyPagination,
    refresh: refreshHistory,
  } = usePaginatedTable<HistoryEntry>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "history",
        await api.permHistory({
          page,
          pageSize,
          q,
          action: filters.action,
          entityType: filters.entityType,
        }),
      ),
    enabled: activeTab === "historial",
    resetKey: refreshKey,
  });

  const [form, setForm] = useState({
    plate: "",
    zone: "",
    vehicleType: "auto" as "auto" | "motorcycle",
    notes: "",
    hours: 1,
  });

  const [cashQuote, setCashQuote] = useState<QuoteResult | null>(null);
  const [mpQuote, setMpQuote] = useState<QuoteResult | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentOrderInfo | null>(
    null,
  );
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [plazasZone, setPlazasZone] = useState("");
  const { busy: loadingQr, run: runLoadQr } = useSubmitLock();
  const { busy: completing, run: runComplete } = useSubmitLock();
  const { busy: extending, run: runExtend } = useSubmitLock();
  const [extendHours, setExtendHours] = useState(1);
  const [graceTick, setGraceTick] = useState(0);
  const [controlPermits, setControlPermits] = useState<Permit[]>([]);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlTick, setControlTick] = useState(0);

  const geo = useGeolocation(activeTab === "nuevo");

  const isStaff = user?.role === "admin" || user?.role === "municipio";
  const canPickZone = isStaff;

  const assignedCode = useMemo(
    () => zoneCodeForUser(user, zones),
    [user, zones],
  );

  const loadMeta = useCallback(async () => {
    try {
      const [s, z, t] = await Promise.all([
        api.shiftStatus(),
        api.parkingZones({ pageSize: 100 }),
        api.tariffs(),
      ]);
      setShift(s);
      setZones(z.zones);
      setTariffs(t.tariffs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }, [toast]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta, refreshKey]);

  useEffect(() => {
    if (activeTab !== "control") return;
    let cancelled = false;
    setControlLoading(true);
    void api
      .permisionarioControl()
      .then((r) => {
        if (!cancelled) setControlPermits(r.permits);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Error al cargar control");
        }
      })
      .finally(() => {
        if (!cancelled) setControlLoading(false);
      });
    const poll = window.setInterval(() => {
      void api
        .permisionarioControl()
        .then((r) => setControlPermits(r.permits))
        .catch(() => null);
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [activeTab, refreshKey, toast]);

  useEffect(() => {
    if (activeTab !== "control") return;
    const id = window.setInterval(() => setControlTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  useEffect(() => {
    if (!navTarget) return;
    if (navTarget.kind === "permit") {
      const p =
        permits.find(
          (x) =>
            formatRef(x) === navTarget.ref ||
            x.id === navTarget.id ||
            x.id === navTarget.ref,
        ) ?? null;
      if (p) {
        setSelected(p);
        onNavHandled?.();
      }
      return;
    }
    if (navTarget.kind === "user" && isStaff) {
      const match = permits.find((x) => x.permisionarioRef === navTarget.ref);
      if (match) {
        setSelected(match);
        onNavHandled?.();
      }
    }
  }, [navTarget, permits, isStaff, onNavHandled]);

  useEffect(() => {
    if (!zones.length && !assignedCode) return;
    const code = assignedCode || zones[0]?.code || "";
    setForm((f) => ({ ...f, zone: code }));
    setPlazasZone((prev) => prev || code);
  }, [assignedCode, zones]);

  useEffect(() => {
    setSelectedSpotId(null);
    setSelectedSpot(null);
  }, [form.zone, assignedCode]);

  const minutes = form.hours * 60;

  const isFreeSpot = selectedSpot?.spotType === "gratuita";

  const hasDigitalDiscount =
    !isFreeSpot && (tariffs?.digitalDiscountRate ?? 0) > 0;

  useEffect(() => {
    if (activeTab !== "nuevo") return;
    let cancelled = false;
    (async () => {
      try {
        if (isFreeSpot && tariffs) {
          setCashQuote({
            plate: form.plate || null,
            vehicleType: form.vehicleType,
            minutes,
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
          setMpQuote(null);
          return;
        }
        const cash = await api.quote({
          vehicleType: form.vehicleType,
          minutes,
          digitalPayment: false,
          plate: form.plate || undefined,
        });
        if (cancelled) return;
        setCashQuote(cash);
        if (!hasDigitalDiscount) {
          setMpQuote(null);
          return;
        }
        const mp = await api.quote({
          vehicleType: form.vehicleType,
          minutes,
          digitalPayment: true,
          plate: form.plate || undefined,
        });
        if (!cancelled) setMpQuote(mp);
      } catch {
        if (!cancelled) {
          setCashQuote(null);
          setMpQuote(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    form.vehicleType,
    form.hours,
    form.plate,
    minutes,
    hasDigitalDiscount,
    isFreeSpot,
    tariffs,
  ]);

  const mpNet = hasDigitalDiscount ? mpQuote?.net : cashQuote?.net;

  const permitZoneOptions = zoneOptionsForPermit(
    zones,
    assignedCode,
    canPickZone,
  );

  const effectivePermitZone =
    form.zone || assignedCode || zones[0]?.code || "";

  const allZoneSelectOpts = useMemo(
    () =>
      zones
        .filter((z) => z.enabled)
        .map((z) => ({ value: z.code, label: z.name })),
    [zones],
  );

  const permitZoneSelectOpts = useMemo(
    () => zoneCodeOptions(zones, permitZoneOptions),
    [zones, permitZoneOptions],
  );

  const showZonePicker = canPickZone && permitZoneSelectOpts.length > 1;

  const assignedZoneName =
    user?.zoneName ||
    zoneLabel(form.zone || assignedCode, zones) ||
    assignedCode;

  async function createPermit(paymentMethod: "cash" | "mercadopago") {
    if (!form.plate.trim()) {
      toast.error("La patente es obligatoria.");
      return;
    }
    if (!selectedSpotId) {
      toast.error("Seleccioná una plaza libre para el vehículo.");
      return;
    }
    await runSubmit(async () => {
      const spotLabel = selectedSpot?.label;
      try {
        const res = await api.createPermit({
          plate: form.plate,
          zone: form.zone || assignedCode,
          vehicleType: form.vehicleType,
          notes: form.notes,
          durationMinutes: minutes,
          paymentMethod,
          spotId: selectedSpotId,
          lat: geo.lat ?? undefined,
          lng: geo.lng ?? undefined,
        });
        setForm((f) => ({
          ...f,
          plate: "",
          notes: "",
          zone: assignedCode,
        }));
        setSelectedSpotId(null);
        setSelectedSpot(null);
        await refreshPermits();
        if (res.payment) {
          setPendingPayment(res.payment);
          toast.info("Mostrá el QR al conductor para completar el pago.");
        } else {
          toast.success(
            spotLabel
              ? `Permiso registrado · plaza ${spotLabel} ocupada.`
              : "Permiso registrado.",
          );
          onTabChange?.("permisos");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  useEffect(() => {
    if (selected?.status !== "grace") return;
    const id = window.setInterval(() => setGraceTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [selected?.status, selected?.graceUntil]);

  async function completeCheckout(permit: Permit) {
    await runComplete(async () => {
      try {
        const { message } = await api.completePermit(permit.id);
        toast.success(message ?? "Vehículo retirado · plaza liberada.");
        setSelected(null);
        await refreshPermits();
        await refreshHistory();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function extendSession(permit: Permit) {
    await runExtend(async () => {
      try {
        const result = await api.extendPermit(permit.id, { hours: extendHours });
        toast.success(result.message ?? "Sesión extendida.");
        if (result.payment) setPendingPayment(result.payment);
        setSelected(result.permit);
        await refreshPermits();
        await refreshHistory();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function showPermitQr(permit: Permit) {
    await runLoadQr(async () => {
      try {
        const { payment } = await api.getPermitPayment(permit.id);
        if (!payment) {
          toast.error("No hay un pago pendiente para este permiso.");
          return;
        }
        setPendingPayment(payment);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar QR");
      }
    });
  }

  async function saveObservation() {
    if (!selected || !observation.trim()) return;
    await runObs(async () => {
      try {
        await api.addObservation(selected.id, observation);
        setObservation("");
        setSelected(null);
        await refreshPermits();
        await refreshHistory();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function partialUpdate(field: string, value: string) {
    if (!selected) return;
    try {
      await api.updatePermit(selected.id, {
        [field]: value,
        observation: `Ajuste de ${field}`,
      });
      await refreshPermits();
      await refreshHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  const editZoneOptions = selected
    ? zoneOptionsForPermit(
        zones,
        isStaff ? selected.zone : assignedCode,
        canPickZone,
      )
    : [];

  const editZoneSelectOpts = useMemo(
    () => zoneCodeOptions(zones, editZoneOptions),
    [zones, editZoneOptions],
  );

  const ratePerHour =
    form.vehicleType === "motorcycle"
      ? tariffs?.motorcyclePerHour
      : tariffs?.autoPerHour;

  return (
    <>
      {pendingPayment && (
        <div className="payment-qr-modal" role="dialog" aria-modal="true">
          <div className="payment-qr-card panel">
            <PaymentOrderDisplay
              orderId={pendingPayment.orderId}
              amount={pendingPayment.amount}
              currencyId={pendingPayment.currencyId}
              paymentUrl={pendingPayment.paymentUrl}
              subtitle="El conductor puede escanear el QR o ingresar el código en su app."
              qrSize={340}
            />
            <div className="action-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPendingPayment(null);
                  onTabChange?.("permisos");
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab !== "nuevo" && (
        <ShiftBanner shift={shift} tariffs={tariffs} />
      )}

      {activeTab === "nuevo" && (
        <section className="panel">
          <h2>Crear permiso de estacionamiento</h2>

          {shift?.canCharge === false ? (
            <OutOfHoursNotice
              shift={shift}
              tariffs={tariffs}
              title="No se pueden efectuar cobros en este horario"
            />
          ) : (
            <>
              {user && tariffs && ratePerHour != null && (
                <div className="permit-summary-card">
              <div className="permit-summary-row">
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Operador</span>
                  <strong>{user.name}</strong>
                  <span className="permit-summary-meta">
                    {ROLE_LABELS[user.role]}
                    {user.legajo ? ` · Leg. ${user.legajo}` : ""}
                  </span>
                </div>
                <div className="permit-summary-item">
                  <span className="permit-summary-label">
                    {canPickZone ? "Zona del permiso" : "Zona asignada"}
                  </span>
                  <strong>
                    {canPickZone
                      ? zoneLabel(effectivePermitZone, zones)
                      : assignedZoneName}
                  </strong>
                </div>
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Cobro</span>
                  <strong
                    className={
                      shift?.canCharge ? "permit-cobro-ok" : "permit-cobro-off"
                    }
                  >
                    {shift?.canCharge ? "Habilitado" : "No habilitado"}
                  </strong>
                  {shift?.message && (
                    <span className="permit-summary-meta">{shift.message}</span>
                  )}
                </div>
                <div className="permit-summary-item">
                  <span className="permit-summary-label">Tarifa vigente</span>
                  <strong>
                    ${ratePerHour.toLocaleString("es-AR")}/h
                  </strong>
                  <span className="permit-summary-meta">
                    {form.vehicleType === "motorcycle"
                      ? "Motocicleta"
                      : "Automóvil"}{" "}
                    · {form.hours}{" "}
                    {form.hours === 1 ? "hora" : "horas"}
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
                        ? "Plaza gratuita · solo efectivo"
                        : `Efectivo${hasDigitalDiscount && mpQuote && mpQuote.net < cashQuote.net ? ` · Mercado Pago $${mpQuote.net.toLocaleString("es-AR")} (−${Math.round((tariffs?.digitalDiscountRate ?? 0) * 100)}%)` : ""}`}
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

          <form
            className="form-grid"
            onSubmit={(e) => e.preventDefault()}
          >
            {showZonePicker && (
              <label>
                Zona *
                <SearchableSelect
                  value={form.zone}
                  onChange={(v) => setForm({ ...form, zone: v })}
                  options={permitZoneSelectOpts}
                />
              </label>
            )}
            <label>
              Patente *
              <input
                required
                value={form.plate}
                onChange={(e) =>
                  setForm({ ...form, plate: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              Vehículo
              <select
                value={form.vehicleType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vehicleType: e.target.value as "auto" | "motorcycle",
                  })
                }
              >
                <option value="auto">
                  Automóvil (${tariffs?.autoPerHour ?? 700}/h)
                </option>
                <option value="motorcycle">
                  Motocicleta (${tariffs?.motorcyclePerHour ?? 300}/h)
                </option>
              </select>
            </label>
            <label>
              Horas de estadía *
              <select
                value={form.hours}
                onChange={(e) =>
                  setForm({ ...form, hours: Number(e.target.value) })
                }
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hora" : "horas"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notas
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </form>

          <PermitSpotPicker
            zoneCode={effectivePermitZone}
            zones={zones}
            selectedSpotId={selectedSpotId}
            onSpotChange={(id, spot) => {
              setSelectedSpotId(id);
              setSelectedSpot(spot);
            }}
            disabled={submitting}
          />

          <div className="action-buttons permit-pay-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || !form.plate.trim() || !selectedSpotId}
              onClick={() => createPermit("cash")}
            >
              {submitting
                ? "Registrando…"
                : isFreeSpot
                  ? "Registrar · Gratuita · $0"
                  : cashQuote
                    ? `Efectivo · $${cashQuote.net.toLocaleString("es-AR")}`
                    : "Registrar pago en efectivo"}
            </button>
            {!isFreeSpot && (
              <button
                type="button"
                className="btn-mp"
                disabled={
                  submitting ||
                  !form.plate.trim() ||
                  !selectedSpotId ||
                  !user?.mercadoPagoLinked
                }
                onClick={() => createPermit("mercadopago")}
                title={
                  user?.mercadoPagoLinked
                    ? "Cobrar con Mercado Pago"
                    : "Vinculá Mercado Pago en Mi cuenta"
                }
              >
                {submitting
                  ? "Registrando…"
                  : mpNet != null
                    ? `Mercado Pago · $${mpNet.toLocaleString("es-AR")}`
                    : "Mercado Pago"}
              </button>
            )}
          </div>
            </>
          )}
        </section>
      )}

      {activeTab === "control" && (
        <section className="panel">
          <h2>Control de permisos</h2>
          <p className="panel-desc">
            Permisos activos y en tolerancia, ordenados del que vence antes al
            que más tiempo le queda. El contador se actualiza en vivo.
          </p>

          <ZonesMap zones={zones} height={280} />

          {controlLoading && controlPermits.length === 0 ? (
            <p className="info-inline">Cargando…</p>
          ) : controlPermits.length === 0 ? (
            <p className="empty">No hay permisos activos en este momento.</p>
          ) : (
            <div className="control-queue" aria-live="polite">
              <table className="control-queue-table">
                <thead>
                  <tr>
                    <th>Patente</th>
                    <th>Estado</th>
                    <th>Tiempo restante</th>
                    <th>Zona</th>
                    <th>Plaza</th>
                    <th>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {controlPermits.map((p) => {
                    const deadline = permitDeadlineIso(p);
                    const msLeft = remainingMs(deadline);
                    const urgent = msLeft > 0 && msLeft <= 5 * 60_000;
                    const expired = msLeft <= 0;
                    return (
                      <tr
                        key={p.id}
                        className={`control-queue-row${urgent ? " urgent" : ""}${expired ? " expired" : ""}`}
                      >
                        <td>
                          <strong>{p.plate}</strong>
                        </td>
                        <td>
                          <span
                            className={`chip${p.status === "grace" ? " chip-warn" : ""}`}
                          >
                            {PERMIT_STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`control-remaining${urgent ? " urgent" : ""}`}
                          >
                            {formatControlRemaining(deadline)}
                          </span>
                        </td>
                        <td>{zoneLabel(p.zone, zones)}</td>
                        <td>{p.spotLabel ?? "—"}</td>
                        <td className="meta">
                          {deadline
                            ? new Date(deadline).toLocaleString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* controlTick fuerza re-render del contador cada segundo */}
          <span className="sr-only" aria-hidden="true">
            {controlTick}
          </span>
        </section>
      )}

      {activeTab === "permisos" && (
        <div className="split-panel">
          <section className="panel">
            <h2>{isStaff ? "Permisos" : "Mis permisos"}</h2>
            <DataTable
              rows={permits}
              rowKey={(p) => p.id}
              selectedKey={selected?.id ?? null}
              searchPlaceholder="Buscar por ID, patente, zona…"
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
                    <span className={`chip${p.status === "grace" ? " chip-warn" : ""}`}>
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
                ...(isStaff
                  ? [
                      {
                        key: "permisionarioRef",
                        header: "ID perm.",
                        searchValues: (p: Permit) => [
                          p.permisionarioRef,
                          p.permisionarioName,
                        ],
                        render: (p: Permit) =>
                          p.permisionarioRef ? (
                            <RefCell
                              refId={p.permisionarioRef}
                              entityKind="user"
                            />
                          ) : (
                            "—"
                          ),
                      },
                      {
                        key: "permisionario",
                        header: "Permisionario",
                        searchValues: (p: Permit) => [p.permisionarioName],
                        render: (p: Permit) => p.permisionarioName,
                      },
                    ]
                  : []),
                {
                  key: "spot",
                  header: "Plaza",
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
                  render: (p) => (
                    <TableActions>
                      {(p.status === "active" || p.status === "grace") && (
                        <button
                          type="button"
                          className="btn-small"
                          disabled={loadingQr}
                          onClick={() => void showPermitQr(p)}
                        >
                          Ver QR
                        </button>
                      )}
                      {p.status === "grace" && (
                        <>
                          <button
                            type="button"
                            className="btn-small btn-primary"
                            disabled={completing}
                            onClick={() => void completeCheckout(p)}
                          >
                            Retirado
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            disabled={extending}
                            onClick={() => {
                              setSelected(p);
                              setExtendHours(1);
                            }}
                          >
                            Extender
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => setSelected(p)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => setSelected(p)}
                      >
                        Editar
                      </button>
                    </TableActions>
                  ),
                },
              ]}
            />
          </section>

          {selected && (
            <section className="panel">
              <h2>Editar {selected.plate}</h2>
              {selected.pricing && (
                <PriceCard
                  title="Tarifa del permiso"
                  plate={selected.plate}
                  minutes={selected.durationMinutes ?? undefined}
                  pricing={selected.pricing as PricingBreakdown}
                />
              )}
              {selected.spotLabel && (
                <p className="panel-desc">
                  Plaza asignada: <strong>{selected.spotLabel}</strong>
                </p>
              )}
              {selected.status === "grace" && (
                <div className="grace-banner panel-desc">
                  <p>
                    <strong>Período de tolerancia (15 min).</strong> El permiso
                    venció; confirmá si el vehículo se retiró o extendé la
                    sesión.
                    {selected.graceUntil && (
                      <>
                        {" "}
                        Tiempo restante:{" "}
                        <strong>
                          {graceTick >= 0 &&
                            formatGraceRemaining(selected.graceUntil)}
                        </strong>
                      </>
                    )}
                  </p>
                  <div className="form-grid grace-actions">
                    <label>
                      Horas a extender
                      <select
                        value={extendHours}
                        onChange={(e) =>
                          setExtendHours(Number(e.target.value))
                        }
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h} h
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={extending}
                        onClick={() => void extendSession(selected)}
                      >
                        {extending ? "Extendiendo…" : "Extender sesión"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={completing}
                        onClick={() => void completeCheckout(selected)}
                      >
                        {completing ? "Guardando…" : "Vehículo retirado"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="form-grid">
                <label>
                  Estado
                  <select
                    defaultValue={selected.status}
                    disabled={selected.status === "grace"}
                    onChange={(e) => partialUpdate("status", e.target.value)}
                  >
                    <option value="active">Activo</option>
                    <option value="grace">En tolerancia</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                {canPickZone && editZoneSelectOpts.length > 1 && (
                  <label>
                    Zona
                    <SearchableSelect
                      value={selected.zone}
                      onChange={(v) => partialUpdate("zone", v)}
                      options={editZoneSelectOpts}
                    />
                  </label>
                )}
                <label>
                  Observación (queda en historial)
                  <textarea
                    rows={3}
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                  />
                </label>
                <div className="action-buttons">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingObs}
                    onClick={saveObservation}
                  >
                    {savingObs ? "Guardando…" : "Guardar observación"}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "historial" && (
        <section className="panel">
          <h2>Historial de cambios</h2>
          <HistoryTable
            rows={history}
            showActor={isStaff}
            serverPagination={historyPagination}
          />
        </section>
      )}

      {activeTab === "plazas" && (
        <PermisionarioSpotPanel
          zoneCode={plazasZone || effectivePermitZone}
          zones={zones}
          showZonePicker={canPickZone || permitZoneSelectOpts.length > 1}
          zoneOptions={
            canPickZone ? allZoneSelectOpts : permitZoneSelectOpts
          }
          onZoneChange={setPlazasZone}
        />
      )}

      {activeTab === "cuenta" && <AccountProfilePanel />}
    </>
  );
}
