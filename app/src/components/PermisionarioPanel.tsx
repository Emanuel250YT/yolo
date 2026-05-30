import { useCallback, useEffect, useMemo, useState } from "react";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { api, unwrapPaginated } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useDevTools } from "../dev/DevToolsContext";
import { usePaginatedTable } from "../hooks/usePaginatedTable";
import { useToast } from "./Toast";
import { DataTable, RefCell, TableActions } from "./DataTable";
import { HistoryTable } from "./HistoryTable";
import { OutOfHoursNotice } from "./OutOfHoursNotice";
import { PermisionarioSpotPanel } from "./PermisionarioSpotPanel";
import { PriceCard } from "./PriceCard";
import { SearchableSelect } from "./SearchableSelect";
import { ShiftBanner } from "./ShiftBanner";
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
  Permit,
  PricingBreakdown,
  QuoteResult,
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

export function PermisionarioPanel({
  activeTab,
  onTabChange,
  navTarget,
  onNavHandled,
}: PermisionarioPanelProps) {
  const { user, refreshUser } = useAuth();
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
  const { busy: linkingMp, run: runLinkMp } = useSubmitLock();

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
    setForm((f) => ({ ...f, zone: assignedCode || zones[0]?.code || "" }));
  }, [assignedCode, zones]);

  const minutes = form.hours * 60;

  useEffect(() => {
    if (activeTab !== "nuevo") return;
    let cancelled = false;
    (async () => {
      try {
        const [cash, mp] = await Promise.all([
          api.quote({
            vehicleType: form.vehicleType,
            minutes,
            digitalPayment: false,
            plate: form.plate || undefined,
          }),
          api.quote({
            vehicleType: form.vehicleType,
            minutes,
            digitalPayment: true,
            plate: form.plate || undefined,
          }),
        ]);
        if (!cancelled) {
          setCashQuote(cash);
          setMpQuote(mp);
        }
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
  }, [activeTab, form.vehicleType, form.hours, form.plate, minutes]);

  const permitZoneOptions = zoneOptionsForPermit(
    zones,
    assignedCode,
    canPickZone,
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
    await runSubmit(async () => {
      try {
        await api.createPermit({
          plate: form.plate,
          zone: form.zone || assignedCode,
          vehicleType: form.vehicleType,
          notes: form.notes,
          durationMinutes: minutes,
          paymentMethod,
        });
        setForm((f) => ({
          ...f,
          plate: "",
          notes: "",
          zone: assignedCode,
        }));
        await refreshPermits();
        onTabChange?.("permisos");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function linkMercadoPago() {
    await runLinkMp(async () => {
      try {
        const res = await api.mercadoPagoAuthorize();
        if (res.linked) {
          await refreshUser();
          toast.info("Ya tenés Mercado Pago vinculado.");
          return;
        }
        if (!res.url) {
          toast.error("No se pudo obtener el enlace de Mercado Pago.");
          return;
        }
        window.location.href = res.url;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
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
                  <span className="permit-summary-label">Zona asignada</span>
                  <strong>{assignedZoneName}</strong>
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
                      Efectivo
                      {mpQuote && mpQuote.digitalDiscount > 0
                        ? ` · MP $${mpQuote.net.toLocaleString("es-AR")}`
                        : ""}
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
            {showZonePicker && (
              <label>
                Zona
                <SearchableSelect
                  value={form.zone}
                  onChange={(v) => setForm({ ...form, zone: v })}
                  options={permitZoneSelectOpts}
                />
              </label>
            )}
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

          <div className="action-buttons permit-pay-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || !form.plate.trim()}
              onClick={() => createPermit("cash")}
            >
              {submitting ? "Registrando…" : "Registrar pago en efectivo"}
            </button>
            <button
              type="button"
              className="btn-mp"
              disabled={
                submitting || !form.plate.trim() || !user?.mercadoPagoLinked
              }
              onClick={() => createPermit("mercadopago")}
              title={
                user?.mercadoPagoLinked
                  ? "Cobrar con Mercado Pago"
                  : "Vinculá Mercado Pago en Mi cuenta"
              }
            >
              MercadoPago
            </button>
          </div>
            </>
          )}
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
                  render: (p) => <span className="chip">{p.status}</span>,
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
                  key: "net",
                  header: "Importe",
                  render: (p) =>
                    p.pricing
                      ? `$${(p.pricing as PricingBreakdown).net.toLocaleString("es-AR")}`
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
              <div className="form-grid">
                <label>
                  Estado
                  <select
                    defaultValue={selected.status}
                    onChange={(e) => partialUpdate("status", e.target.value)}
                  >
                    <option value="active">Activo</option>
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
        <PermisionarioSpotPanel zoneCode={assignedCode} zones={zones} />
      )}

      {activeTab === "cuenta" && user && (
        <section className="panel">
          <h2>Mi cuenta</h2>
          <dl className="account-details">
            <div>
              <dt>Nombre</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            {user.legajo && (
              <div>
                <dt>Legajo</dt>
                <dd>{user.legajo}</dd>
              </div>
            )}
            {assignedZoneName && (
              <div>
                <dt>Zona(s)</dt>
                <dd>{assignedZoneName}</dd>
              </div>
            )}
          </dl>

          <div className="account-mp">
            <h3>Mercado Pago</h3>
            {user.mercadoPagoLinked ? (
              <p className="account-mp-status account-mp-status--linked">
                Cuenta vinculada
                {user.mercadoPagoLinkedAt && (
                  <span className="account-mp-meta">
                    {" "}
                    · desde{" "}
                    {new Date(user.mercadoPagoLinkedAt).toLocaleDateString(
                      "es-AR",
                    )}
                  </span>
                )}
              </p>
            ) : (
              <>
                <p className="account-mp-status">
                  Todavía no vinculaste tu cuenta de Mercado Pago. Es necesario
                  para cobrar permisos con pago digital.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={linkingMp}
                  onClick={() => void linkMercadoPago()}
                >
                  {linkingMp ? "Redirigiendo…" : "Vincular Mercado Pago"}
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
