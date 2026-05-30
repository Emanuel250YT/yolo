import { useDevTools } from "../dev/DevToolsContext";
import { getDevNowMs } from "../dev/devConfig";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { DataTable, TableActions } from "../components/DataTable";
import { ParkingAlertsBanner } from "../components/ParkingAlertsBanner";
import { PaymentHoldBanner } from "../components/PaymentHoldBanner";
import { SpotMap } from "../components/SpotMap";
import { ZonesMap } from "../components/ZonesMap";
import { useGeolocation } from "../hooks/useGeolocation";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { defaultImageBounds } from "../utils/spotMapStyles";
import { sortBlocksByDistance, spotLiveStatus } from "../utils/geo";
import {
  buildReservationStartSlots,
  defaultStartSlot,
  RESERVATION_HOUR_OPTIONS,
} from "../utils/reservationSchedule";
import type {
  ConductorVehicle,
  ParkingAlert,
  ParkingBlock,
  Reservation,
  Spot,
  SpotHold,
} from "../types";

const NAV = [
  { id: "inicio", label: "Inicio" },
  { id: "vehiculos", label: "Vehículos" },
  { id: "lugares", label: "Lugares" },
  { id: "reservar", label: "Reservar" },
  { id: "mis-reservas", label: "Reservas" },
];

const REGIONS = ["Centro", "Norte", "Sur", "Este", "Oeste"];

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
  const [tab, setTab] = useState("inicio");
  const [spots, setSpots] = useState<Spot[]>([]);
  const [blocks, setBlocks] = useState<ParkingBlock[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<ConductorVehicle[]>([]);
  const [alerts, setAlerts] = useState<ParkingAlert[]>([]);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [holdPaymentMinutes, setHoldPaymentMinutes] = useState(10);
  const [mapZone, setMapZone] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [activeHold, setActiveHold] = useState<SpotHold | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [slotTick, setSlotTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const geo = useGeolocation(tab === "reservar" || tab === "lugares");

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
    digitalPayment: true,
  });

  const { busy: holding, run: runHold } = useSubmitLock();
  const { busy: paying, run: runPay } = useSubmitLock();
  const { busy: addingVehicle, run: runAddVehicle } = useSubmitLock();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const startSlots = useMemo(
    () => buildReservationStartSlots(maxAdvance),
    [maxAdvance, slotTick, refreshKey],
  );

  const sortedBlocks = useMemo(() => {
    if (geo.lat != null && geo.lng != null) {
      return sortBlocksByDistance(blocks, geo.lat, geo.lng);
    }
    return blocks;
  }, [blocks, geo.lat, geo.lng]);

  const regionOptions = useMemo(() => {
    const fromBlocks = new Set(
      blocks.map((b) => b.region).filter(Boolean) as string[],
    );
    return REGIONS.filter((r) => fromBlocks.has(r) || fromBlocks.size === 0);
  }, [blocks]);

  const blocksInRegion = useMemo(() => {
    let list = sortedBlocks;
    if (selectedRegion) {
      list = list.filter((b) => b.region === selectedRegion);
    }
    if (mapZone) {
      list = list.filter((b) => b.zoneCode === mapZone);
    }
    return list;
  }, [sortedBlocks, selectedRegion, mapZone]);

  const blockSpots = useMemo(
    () =>
      selectedBlockId
        ? spots.filter((s) => s.blockId === selectedBlockId)
        : [],
    [spots, selectedBlockId],
  );

  const filteredSpots = useMemo(
    () => (mapZone ? spots.filter((s) => s.zone === mapZone) : spots),
    [spots, mapZone],
  );

  const refreshLiveSpots = useCallback(async () => {
    try {
      const { spots: live } = await api.spotsLive(
        selectedBlockId ? { blockId: selectedBlockId } : undefined,
      );
      setSpots(live);
    } catch {
      /* ignore polling errors */
    }
  }, [selectedBlockId]);

  const load = useCallback(async () => {
    try {
      const [s, r, c, v, a, b] = await Promise.all([
        api.spotsLive(),
        api.reservations(),
        api.conductorConfig(),
        api.conductorVehicles(),
        api.conductorParkingAlerts(),
        api.conductorBlocks(),
      ]);
      setSpots(s.spots);
      setReservations(r.reservations);
      setMaxAdvance(c.maxAdvanceMinutes);
      setHoldPaymentMinutes(c.holdPaymentMinutes ?? 10);
      setVehicles(v.vehicles);
      setAlerts(a.alerts);
      setBlocks(b.blocks);
      setForm((f) => ({
        ...f,
        plate: f.plate || v.vehicles[0]?.plate || "",
        scheduledStart: defaultStartSlot(c.maxAdvanceMinutes),
      }));
      setSelectedRegion((prev) => prev || b.blocks[0]?.region || "Centro");
      setSelectedBlockId((prev) => prev || b.blocks[0]?.id || "");
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
    if (tab !== "reservar" && tab !== "lugares") return;
    refreshLiveSpots();
    const id = window.setInterval(() => {
      refreshLiveSpots();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [tab, refreshLiveSpots, refreshKey]);

  useEffect(() => {
    if (!startSlots.some((s) => s.value === form.scheduledStart)) {
      setForm((f) => ({
        ...f,
        scheduledStart: startSlots[0]?.value ?? defaultStartSlot(maxAdvance),
      }));
    }
  }, [startSlots, form.scheduledStart, maxAdvance]);

  useEffect(() => {
    if (!activeHold) return;
    const id = window.setInterval(async () => {
      const exp = new Date(activeHold.expiresAt).getTime();
      if (exp <= getDevNowMs()) {
        setActiveHold(null);
        setSelectedSpotId(null);
        await refreshLiveSpots();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeHold, refreshLiveSpots, refreshKey]);

  function goRenew(plate: string) {
    setForm((f) => ({ ...f, plate }));
    setTab("reservar");
  }

  async function selectSpot(spot: Spot) {
    if (!form.plate) {
      setError("Seleccioná una patente antes de elegir la plaza.");
      return;
    }
    if (activeHold) {
      setError("Completá o cancelá el pago de la plaza actual primero.");
      return;
    }

    await runHold(async () => {
      setError(null);
      const start = new Date(form.scheduledStart).getTime();
      const limit = getDevNowMs() + maxAdvance * 60 * 1000;
      if (start > limit) {
        setError(`Solo podés reservar hasta ${maxAdvance} minutos adelante.`);
        return;
      }
      try {
        const { hold } = await api.createSpotHold(spot.id, {
          plate: form.plate,
          vehicleType: form.vehicleType,
          scheduledStart: form.scheduledStart,
          durationHours: form.durationHours,
          digitalPayment: form.digitalPayment,
        });
        setActiveHold(hold);
        setSelectedSpotId(spot.id);
        await refreshLiveSpots();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al reservar plaza");
      }
    });
  }

  async function payHold(method: "cash" | "mercadopago") {
    if (!activeHold) return;
    await runPay(async () => {
      setError(null);
      try {
        await api.paySpotHold(activeHold.id, method);
        setActiveHold(null);
        setSelectedSpotId(null);
        await load();
        setTab("mis-reservas");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al pagar");
      }
    });
  }

  async function cancelHold() {
    if (!activeHold) return;
    try {
      await api.cancelSpotHold(activeHold.id);
      setActiveHold(null);
      setSelectedSpotId(null);
      await refreshLiveSpots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    await runAddVehicle(async () => {
      setError(null);
      try {
        await api.conductorAddVehicle(vehicleForm);
        setVehicleForm({ plate: "", vehicleType: "auto", label: "" });
        await load();
        setTab("vehiculos");
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
      await load();
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPendingId(null);
    }
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const heldSpot = spots.find((s) => s.id === activeHold?.spotId);

  const mapCenter = useMemo((): [number, number] => {
    if (selectedBlock?.lat != null && selectedBlock.lng != null) {
      return [selectedBlock.lat, selectedBlock.lng];
    }
    return [-24.7859, -65.4115];
  }, [selectedBlock]);

  useEffect(() => {
    const zoneId = selectedBlock?.zoneId;
    if (!zoneId) {
      setReferenceImageUrl(null);
      return;
    }
    api
      .conductorZone(zoneId)
      .then(({ zone }) => {
        if (zone.imageBase64 && zone.imageMimeType) {
          setReferenceImageUrl(
            `data:${zone.imageMimeType};base64,${zone.imageBase64}`,
          );
        } else {
          setReferenceImageUrl(null);
        }
      })
      .catch(() => setReferenceImageUrl(null));
  }, [selectedBlock?.zoneId]);

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

      {(tab === "inicio" || tab === "vehiculos" || tab === "reservar") && (
        <ParkingAlertsBanner alerts={alerts} onRenew={goRenew} />
      )}

      {tab === "inicio" && (
        <section className="panel">
          <h2>Resumen</h2>
          <p className="panel-desc">
            Registrá tus vehículos para recibir avisos cuando haya un permiso de
            estacionamiento activo con tu patente. Elegí plaza por cuadra y pagá
            en {holdPaymentMinutes} minutos.
          </p>
          <ZonesMap spots={spots} onZoneSelect={setMapZone} selectedZone={mapZone} />
          <div className="stat-grid">
            <article className="stat-card">
              <span className="stat-val">{vehicles.length}</span>
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
        </section>
      )}

      {tab === "vehiculos" && (
        <div className="split-panel">
          <section className="panel">
            <h2>Mis vehículos ({vehicles.length})</h2>
            <p className="panel-desc">
              Patentes registradas manualmente o desde el padrón municipal
              (automático).
            </p>
            <DataTable
              rows={vehicles}
              rowKey={(v) => v.id}
              searchPlaceholder="Buscar patente…"
              emptyMessage="Todavía no registraste vehículos."
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
          <h2>Elegir plaza y pagar</h2>
          <p className="panel-desc">
            Seleccioná región y cuadra, elegí tu plaza como en el cine y completá
            el pago en <strong>{holdPaymentMinutes} minutos</strong>. Inicio
            disponible hasta {maxAdvance} minutos adelante.
          </p>

          {geo.loading && (
            <p className="info-inline">Obteniendo tu ubicación…</p>
          )}
          {geo.lat != null && geo.lng != null && (
            <p className="info-inline geo-ok">
              Ubicación activa — cuadras ordenadas por distancia.
            </p>
          )}

          <ZonesMap
            spots={spots}
            selectedZone={mapZone}
            onZoneSelect={setMapZone}
            height={240}
          />

          {activeHold && (
            <PaymentHoldBanner
              hold={activeHold}
              spotLabel={heldSpot?.label}
              onPay={payHold}
              onCancel={cancelHold}
              paying={paying}
            />
          )}

          <div className="form-grid reserve-filters">
            <label>
              Región
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedBlockId("");
                }}
              >
                <option value="">Todas</option>
                {regionOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cuadra *
              <select
                required
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
              >
                <option value="" disabled>
                  Seleccionar cuadra
                </option>
                {blocksInRegion.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.zoneName ? ` · ${b.zoneName}` : ""}
                    {b.distanceM != null && geo.lat != null
                      ? ` (${Math.round(b.distanceM)} m)`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Patente *
              <select
                required
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value })}
              >
                <option value="" disabled>
                  Seleccionar patente
                </option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.plate}>
                    {v.plate}
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
              Duración (horas) *
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
                <option value="auto">Automóvil</option>
                <option value="motorcycle">Motocicleta</option>
              </select>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.digitalPayment}
                onChange={(e) =>
                  setForm({ ...form, digitalPayment: e.target.checked })
                }
              />
              Pago digital (−20 %)
            </label>
          </div>

          <SpotMap
            spots={blockSpots}
            mode="pick"
            center={mapCenter}
            height={440}
            referenceImageUrl={referenceImageUrl}
            imageBounds={defaultImageBounds(mapCenter)}
            selectedSpotId={selectedSpotId}
            onSpotSelect={selectSpot}
            disabled={holding || !!activeHold || !vehicles.length}
            hint="Tocá una plaza verde en el mapa para reservarla. Imagen de referencia superpuesta al callejero."
          />

          {holding && <p className="info-inline">Reservando plaza…</p>}
        </section>
      )}

      {tab === "mis-reservas" && (
        <section className="panel">
          <h2>Mis reservas</h2>
          <div className="card-list">
            {reservations.map((r) => (
              <article key={r.id} className="list-card">
                <strong>{r.plate}</strong> — {r.spotLabel}
                <p>
                  ${r.pricing.net.toLocaleString("es-AR")} ·{" "}
                  {formatDurationHours(r.durationMinutes)} · {r.status}
                </p>
                <time className="meta">
                  Inicio:{" "}
                  {new Date(r.scheduledStart).toLocaleString("es-AR")}
                </time>
                {r.status === "confirmed" && (
                  <button
                    type="button"
                    className="btn-small btn-danger"
                    disabled={!!pendingId}
                    onClick={() => cancelReservation(r.id)}
                  >
                    Cancelar
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
