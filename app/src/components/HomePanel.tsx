import type { ShiftStatus, TariffsResponse } from "../types";

interface HomePanelProps {
  tariffs: TariffsResponse | null;
  shift: ShiftStatus | null;
}

export function HomePanel({ tariffs, shift }: HomePanelProps) {
  const t = tariffs?.tariffs;

  return (
    <div className="home-grid">
      <section className="hero panel">
        <p className="eyebrow">Ordenanza N.º 12.170</p>
        <h1>Estacionamiento medido digital</h1>
        <p className="hero-text">
          Reemplazamos el talonario manual por trazabilidad en tiempo real,
          medios de pago electrónicos y reglas tarifarias automáticas para el
          microcentro de Salta.
        </p>
        <ul className="hero-list">
          <li>Descuento 20 % en pagos digitales</li>
          <li>Fraccionamiento cada 15 min desde la 2.ª hora</li>
          <li>Tolerancia de 5 minutos sin cargo</li>
          <li>Turnos diurno y nocturno con zonas habilitadas</li>
        </ul>
      </section>

      {t && (
        <section className="stats panel">
          <h2>Tarifas vigentes</h2>
          <div className="stat-cards">
            <article>
              <span className="stat-val">${t.autoPerHour}</span>
              <span className="stat-lbl">/ hora · automóvil</span>
            </article>
            <article>
              <span className="stat-val">${t.motorcyclePerHour}</span>
              <span className="stat-lbl">/ hora · motocicleta</span>
            </article>
            <article>
              <span className="stat-val">{t.toleranceMinutes} min</span>
              <span className="stat-lbl">tolerancia sin cargo</span>
            </article>
          </div>
        </section>
      )}

      {shift && shift.zones.length > 0 && (
        <section className="panel zones">
          <h2>Zonas nocturnas</h2>
          <ul>
            {shift.zones.map((z) => (
              <li key={z}>{z.replace(/-/g, " ")}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
