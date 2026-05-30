import type { ParkingBlock, Spot } from "../types";
import { filterSpotsByBlock } from "../utils/spotFilters";
import { spotStatusOf } from "../utils/spotMapStyles";

interface BlockSpotFilterProps {
  spots: Spot[];
  blocks: ParkingBlock[];
  blockId: string;
  onBlockIdChange: (blockId: string) => void;
  disabled?: boolean;
}

export function BlockSpotFilter({
  spots,
  blocks,
  blockId,
  onBlockIdChange,
  disabled,
}: BlockSpotFilterProps) {
  if (!blocks.length) return null;

  const visible = filterSpotsByBlock(spots, blockId);
  const free = visible.filter((s) => spotStatusOf(s) === "available").length;

  return (
    <label className="block-select-inline">
      Cuadra / tramo
      <select
        value={blockId}
        disabled={disabled}
        onChange={(e) => onBlockIdChange(e.target.value)}
      >
        <option value="">
          Todas las plazas ({spots.length})
        </option>
        {blocks.map((b) => {
          const count = spots.filter((s) => s.blockId === b.id).length;
          return (
            <option key={b.id} value={b.id}>
              {b.name}
              {count > 0 ? ` (${count})` : ""}
            </option>
          );
        })}
      </select>
      <span className="block-select-meta muted">
        {visible.length} en vista · {free} libres
      </span>
    </label>
  );
}
