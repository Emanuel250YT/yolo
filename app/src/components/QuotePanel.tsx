import { useState } from "react";
import { api } from "../api/client";
import type { QuoteResult, Tariffs } from "../types";
import { PriceCard } from "./PriceCard";

interface QuotePanelProps {
  tariffs: Tariffs | null;
  onSuccess?: () => void;
}

export function QuotePanel({ tariffs }: QuotePanelProps) {
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState<"auto" | "motorcycle">("auto");
  const [minutes, setMinutes] = useState(60);
  const [digitalPayment, setDigitalPayment] = useState(true);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.quote({
        plate: plate || undefined,
        vehicleType,
        minutes,
        digitalPayment,
      });
      setQuote(result);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Error al cotizar");
    } finally {
      setLoading(false);
    }
  }

  const presets = [15, 30, 60, 90, 120];

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Cotizar estadía</h2>
        <p>Simulá el importe antes de estacionar o al retirar el vehículo.</p>
      </header>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Patente (opcional)
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="AB123CD"
            maxLength={8}
          />
        </label>

        <label>
          Tipo de vehículo
          <select
            value={vehicleType}
            onChange={(e) =>
              setVehicleType(e.target.value as "auto" | "motorcycle")
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
          Duración (minutos)
          <input
            type="number"
            min={0}
            max={480}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>

        <div className="presets">
          {presets.map((m) => (
            <button
              key={m}
              type="button"
              className={minutes === m ? "preset active" : "preset"}
              onClick={() => setMinutes(m)}
            >
              {m} min
            </button>
          ))}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={digitalPayment}
            onChange={(e) => setDigitalPayment(e.target.checked)}
          />
          Pago digital (−20 %, absorbido por la Municipalidad)
        </label>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Calculando…" : "Calcular importe"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {quote && (
        <PriceCard
          title="Cotización"
          plate={quote.plate ?? undefined}
          minutes={quote.minutes}
          pricing={quote}
        />
      )}
    </section>
  );
}
