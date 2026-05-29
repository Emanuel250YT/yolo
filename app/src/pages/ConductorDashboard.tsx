import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { PriceCard } from "../components/PriceCard";
import type { Reservation, Spot } from "../types";

const NAV = [
  { id: "lugares", label: "Lugares" },
  { id: "reservar", label: "Reservar" },
  { id: "mis-reservas", label: "Mis reservas" },
];

function maxScheduleLocal() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function minScheduleLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function ConductorDashboard() {
  const [tab, setTab] = useState("lugares");
  const [spots, setSpots] = useState<Spot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [lastReservation, setLastReservation] = useState<Reservation | null>(
    null,
  );

  const [form, setForm] = useState({
    spotId: "",
    plate: "",
    vehicleType: "auto" as "auto" | "motorcycle",
    scheduledStart: minScheduleLocal(),
    durationMinutes: 60,
    digitalPayment: true,
  });

  const load = useCallback(async () => {
    try {
      const [s, r, c] = await Promise.all([
        api.spots(true),
        api.reservations(),
        api.conductorConfig(),
      ]);
      setSpots(s.spots);
      setReservations(r.reservations);
      setMaxAdvance(c.maxAdvanceMinutes);
      if (s.spots.length && !form.spotId) {
        setForm((f) => ({ ...f, spotId: s.spots[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const start = new Date(form.scheduledStart).getTime();
    const limit = Date.now() + maxAdvance * 60 * 1000;
    if (start > limit) {
      setError(`Solo podés reservar hasta ${maxAdvance} minutos antes.`);
      return;
    }
    try {
      const { reservation } = await api.createReservation({
        ...form,
        scheduledStart: new Date(form.scheduledStart).toISOString(),
      });
      setLastReservation(reservation);
      setTab("mis-reservas");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reservar");
    }
  }

  async function cancel(id: string) {
    await api.cancelReservation(id);
    load();
  }

  const free = (s: Spot) => s.capacity - s.occupied;

  return (
    <AppShell
      title="Conductor"
      subtitle="Lugares disponibles y pago anticipado (máx. 30 min)"
      nav={NAV}
      tab={tab}
      onTab={setTab}
    >
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "lugares" && (
        <section className="panel">
          <h2>Lugares con cupo</h2>
          <div className="spots-grid">
            {spots.map((s) => (
              <article
                key={s.id}
                className={`spot-card ${free(s) > 0 ? "available" : "full"}`}
              >
                <h3>{s.label}</h3>
                <p className="meta">{s.address}</p>
                <p>
                  <span className="chip">{s.zone}</span>
                </p>
                <p className="spot-free">
                  {free(s)} / {s.capacity} libres
                </p>
              </article>
            ))}
            {spots.length === 0 && (
              <p className="empty">No hay lugares disponibles ahora.</p>
            )}
          </div>
        </section>
      )}

      {tab === "reservar" && (
        <section className="panel">
          <h2>Reservar y pagar</h2>
          <p className="panel-desc">
            Anticipo máximo: <strong>{maxAdvance} minutos</strong>
          </p>
          <form className="form-grid" onSubmit={submitReservation}>
            <label>
              Lugar
              <select
                required
                value={form.spotId}
                onChange={(e) => setForm({ ...form, spotId: e.target.value })}
              >
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({free(s)} libres)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Patente
              <input
                required
                value={form.plate}
                onChange={(e) =>
                  setForm({ ...form, plate: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              Inicio
              <input
                type="datetime-local"
                required
                min={minScheduleLocal()}
                max={maxScheduleLocal()}
                value={form.scheduledStart}
                onChange={(e) =>
                  setForm({ ...form, scheduledStart: e.target.value })
                }
              />
            </label>
            <label>
              Duración (min)
              <input
                type="number"
                min={15}
                max={240}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationMinutes: Number(e.target.value),
                  })
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
            <button type="submit" className="btn-primary">
              Confirmar reserva
            </button>
          </form>
          {lastReservation && (
            <PriceCard
              title="Última reserva"
              plate={lastReservation.plate}
              minutes={lastReservation.durationMinutes}
              pricing={lastReservation.pricing}
            />
          )}
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
                  ${r.pricing.net.toLocaleString("es-AR")} · {r.status}
                </p>
                <time className="meta">
                  {new Date(r.scheduledStart).toLocaleString("es-AR")}
                </time>
                {r.status === "confirmed" && (
                  <button
                    type="button"
                    className="btn-small btn-danger"
                    onClick={() => cancel(r.id)}
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
