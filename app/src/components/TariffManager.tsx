import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tariffs } from "../types";

export function TariffManager() {
  const [tariffs, setTariffs] = useState<Tariffs | null>(null);
  const [form, setForm] = useState<Tariffs | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.tariffs();
      setTariffs(res.tariffs);
      setForm(res.tariffs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tarifas");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.municipioUpdateTariffs({ ...form });
      setTariffs(res.tariffs);
      setForm(res.tariffs);
      setMessage(res.message ?? "Tarifas guardadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <section className="panel">
        <p className="empty">Cargando tarifas…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Tarifas de estacionamiento</h2>
      <p className="panel-desc">
        Valores vigentes para el cálculo de permisos y cotizaciones en todo el
        sistema.
      </p>

      {message && <p className="success-inline">{message}</p>}
      {error && <p className="form-error banner-error">{error}</p>}

      <form className="form-standard" onSubmit={save}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="autoPerHour">Automóvil ($/hora)</label>
            <input
              id="autoPerHour"
              type="number"
              min={0}
              step={50}
              required
              value={form.autoPerHour}
              onChange={(e) =>
                setForm({ ...form, autoPerHour: Number(e.target.value) })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="motorcyclePerHour">Motocicleta ($/hora)</label>
            <input
              id="motorcyclePerHour"
              type="number"
              min={0}
              step={50}
              required
              value={form.motorcyclePerHour}
              onChange={(e) =>
                setForm({
                  ...form,
                  motorcyclePerHour: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="toleranceMinutes">Tolerancia (min)</label>
            <input
              id="toleranceMinutes"
              type="number"
              min={0}
              required
              value={form.toleranceMinutes}
              onChange={(e) =>
                setForm({ ...form, toleranceMinutes: Number(e.target.value) })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="fractionMinutes">Fracción (min)</label>
            <input
              id="fractionMinutes"
              type="number"
              min={1}
              required
              value={form.fractionMinutes}
              onChange={(e) =>
                setForm({ ...form, fractionMinutes: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="digitalDiscountRate">
            Descuento pago digital (0–1, ej. 0.2 = 20 %)
          </label>
          <input
            id="digitalDiscountRate"
            type="number"
            min={0}
            max={1}
            step={0.01}
            required
            value={form.digitalDiscountRate}
            onChange={(e) =>
              setForm({
                ...form,
                digitalDiscountRate: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="tariff-preview-grid">
          <article className="price-card price-card--hero">
            <p className="tariff-hero-label">Auto · 1 hora</p>
            <p className="tariff-hero-amount">
              ${form.autoPerHour.toLocaleString("es-AR")}
            </p>
          </article>
          <article className="price-card price-card--hero">
            <p className="tariff-hero-label">Moto · 1 hora</p>
            <p className="tariff-hero-amount">
              ${form.motorcyclePerHour.toLocaleString("es-AR")}
            </p>
          </article>
        </div>

        <div className="action-buttons">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar tarifas"}
          </button>
          {tariffs && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setForm(tariffs)}
            >
              Descartar cambios
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
