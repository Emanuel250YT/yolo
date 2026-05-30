import { useMemo, useState } from "react";
import { spotStatusLabel, spotStatusOf } from "../utils/spotMapStyles";
import type { Spot } from "../types";

const PAGE_SIZE = 48;

interface SpotStatusGridProps {
  spots: Spot[];
  selectedSpotId?: string | null;
  onSpotClick?: (spot: Spot) => void;
  disabled?: boolean;
  pickMode?: boolean;
}

export function SpotStatusGrid({
  spots,
  selectedSpotId,
  onSpotClick,
  disabled,
  pickMode,
}: SpotStatusGridProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spots;
    return spots.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.blockStreet?.toLowerCase().includes(q),
    );
  }, [spots, query]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  if (!spots.length) {
    return <p className="empty">No hay plazas en esta vista.</p>;
  }

  return (
    <div className="spot-status-grid-wrap">
      {spots.length > PAGE_SIZE && (
        <label className="spot-status-search">
          <span>Buscar plaza</span>
          <input
            type="search"
            placeholder="Número o dirección…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        </label>
      )}

      <p className="spot-status-count muted">
        {filtered.length} plaza{filtered.length === 1 ? "" : "s"}
        {query ? " encontradas" : " en vista"}
      </p>

      <div className="spots-grid">
        {visible.map((s) => {
          const st = spotStatusOf(s);
          const selectable = pickMode ? st === "available" : st !== "held";
          const selected = selectedSpotId === s.id;
          return (
            <article
              key={s.id}
              className={`spot-card status-${st}${selected ? " spot-card--selected" : ""}${selectable && onSpotClick ? " spot-card--clickable" : ""}`}
            >
              <h3>{s.label}</h3>
              <p className="meta">{s.blockStreet || s.address || s.zone}</p>
              <p className="spot-card-chips">
                <span className={`chip status-chip status-${st}`}>
                  {spotStatusLabel(s)}
                </span>
                {s.spotType === "gratuita" && (
                  <span className="chip chip--free">Gratuita</span>
                )}
              </p>
              {onSpotClick && selectable && !disabled && (
                <button
                  type="button"
                  className="btn-small spot-card-action"
                  onClick={() => onSpotClick(s)}
                >
                  {pickMode
                    ? selected
                      ? "Seleccionada"
                      : "Seleccionar"
                    : st === "occupied"
                      ? "Marcar libre"
                      : "Marcar ocupada"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          className="btn-small spot-status-more"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        >
          Ver más ({filtered.length - visibleCount} restantes)
        </button>
      )}

      {filtered.length === 0 && query && (
        <p className="empty">Ninguna plaza coincide con la búsqueda.</p>
      )}
    </div>
  );
}
