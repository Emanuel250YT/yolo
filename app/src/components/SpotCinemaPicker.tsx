import { spotLiveStatus } from "../utils/geo";
import type { Spot } from "../types";

interface SpotCinemaPickerProps {
  spots: Spot[];
  selectedSpotId?: string | null;
  onSelect: (spot: Spot) => void;
  disabled?: boolean;
  blockLabel?: string;
}

const STATUS_LABEL: Record<string, string> = {
  available: "Libre",
  held: "Reservada",
  occupied: "Ocupada",
  disabled: "Fuera de servicio",
};

export function SpotCinemaPicker({
  spots,
  selectedSpotId,
  onSelect,
  disabled,
  blockLabel,
}: SpotCinemaPickerProps) {
  if (!spots.length) {
    return <p className="empty">No hay plazas en esta cuadra.</p>;
  }

  const maxRow = Math.max(...spots.map((s) => s.row ?? 0));
  const maxCol = Math.max(...spots.map((s) => s.col ?? 0));
  const grid: (Spot | null)[][] = Array.from({ length: maxRow + 1 }, () =>
    Array(maxCol + 1).fill(null),
  );

  for (const s of spots) {
    grid[s.row ?? 0][s.col ?? 0] = s;
  }

  return (
    <div className="cinema-picker">
      {blockLabel && (
        <p className="cinema-picker-title">
          Cuadra: <strong>{blockLabel}</strong>
        </p>
      )}
      <div className="cinema-screen">CALLE</div>
      <div
        className="cinema-grid"
        style={{
          gridTemplateColumns: `repeat(${maxCol + 1}, minmax(2.5rem, 1fr))`,
        }}
      >
        {grid.flatMap((row, ri) =>
          row.map((spot, ci) => {
            if (!spot) {
              return (
                <span
                  key={`empty-${ri}-${ci}`}
                  className="cinema-seat empty-seat"
                  aria-hidden
                />
              );
            }
            const status = spot.status ?? spotLiveStatus(spot);
            const isSelected = selectedSpotId === spot.id;
            const clickable = status === "available" && !disabled;
            return (
              <button
                key={spot.id}
                type="button"
                className={`cinema-seat status-${status}${isSelected ? " selected" : ""}${spot.heldByMe ? " mine" : ""}`}
                disabled={!clickable}
                title={`${spot.label} — ${STATUS_LABEL[status] ?? status}`}
                onClick={() => clickable && onSelect(spot)}
              >
                <span className="seat-label">{spot.label.replace(/^P-?/, "")}</span>
              </button>
            );
          }),
        )}
      </div>
      <ul className="cinema-legend">
        <li>
          <span className="legend-dot status-available" /> Libre
        </li>
        <li>
          <span className="legend-dot status-held" /> Reservada temporalmente
        </li>
        <li>
          <span className="legend-dot status-occupied" /> Ocupada
        </li>
        <li>
          <span className="legend-dot status-disabled" /> No disponible
        </li>
      </ul>
    </div>
  );
}
