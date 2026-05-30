import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { BlockSpotFilter } from "./BlockSpotFilter";
import { SpotMap } from "./SpotMap";
import { SpotStatusGrid } from "./SpotStatusGrid";
import { SearchableSelect } from "./SearchableSelect";
import { filterSpotsByBlock } from "../utils/spotFilters";
import { defaultImageBounds, spotStatusOf } from "../utils/spotMapStyles";
import { SALTA_CENTER } from "../utils/zoneGeo";
import type { ParkingBlock, ParkingZone, Spot } from "../types";

interface PermisionarioSpotPanelProps {
  zoneCode: string;
  zones: ParkingZone[];
  showZonePicker?: boolean;
  zoneOptions?: { value: string; label: string }[];
  onZoneChange?: (code: string) => void;
}

export function PermisionarioSpotPanel({
  zoneCode,
  zones,
  showZonePicker,
  zoneOptions = [],
  onZoneChange,
}: PermisionarioSpotPanelProps) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [blocks, setBlocks] = useState<ParkingBlock[]>([]);
  const [blockId, setBlockId] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const zone = zones.find((z) => z.code === zoneCode);

  const load = useCallback(async () => {
    if (!zoneCode) {
      setLoading(false);
      setSpots([]);
      return;
    }
    setError(null);
    try {
      const [s, b] = await Promise.all([
        api.permisionarioSpotsLive({ zone: zoneCode }),
        api.permisionarioBlocks(),
      ]);
      setSpots(s.spots);
      setBlocks(b.blocks.filter((x) => x.zoneCode === zoneCode));
      setBlockId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar plazas");
    } finally {
      setLoading(false);
    }
  }, [zoneCode]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 5_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!zone?.id) {
      setReferenceImageUrl(null);
      return;
    }
    api
      .permisionarioZone(zone.id)
      .then(({ zone: z }) => {
        if (z.imageBase64 && z.imageMimeType) {
          setReferenceImageUrl(
            `data:${z.imageMimeType};base64,${z.imageBase64}`,
          );
        } else {
          setReferenceImageUrl(null);
        }
      })
      .catch(() => setReferenceImageUrl(null));
  }, [zone?.id]);

  const displaySpots = useMemo(
    () => filterSpotsByBlock(spots, blockId),
    [spots, blockId],
  );

  const selectedBlock = blocks.find((b) => b.id === blockId);

  const mapCenter = useMemo((): [number, number] => {
    if (selectedBlock?.lat != null && selectedBlock.lng != null) {
      return [selectedBlock.lat, selectedBlock.lng];
    }
    const withCoords = displaySpots.find(
      (s) => s.lat != null && s.lng != null,
    );
    if (withCoords?.lat != null && withCoords.lng != null) {
      return [withCoords.lat, withCoords.lng];
    }
    return SALTA_CENTER;
  }, [selectedBlock, displaySpots]);

  async function toggleSpot(spot: Spot) {
    if (busyId) return;
    const status = spotStatusOf(spot);
    if (status === "held") {
      setError("Plaza con reserva temporal — no se puede modificar.");
      return;
    }
    const nextOccupied = status !== "occupied";
    setBusyId(spot.id);
    setError(null);
    try {
      await api.permisionarioSetSpotOccupancy(spot.id, nextOccupied);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const stats = {
    free: displaySpots.filter((s) => spotStatusOf(s) === "available").length,
    occupied: displaySpots.filter((s) => spotStatusOf(s) === "occupied")
      .length,
    held: displaySpots.filter((s) => spotStatusOf(s) === "held").length,
  };

  return (
    <section className="panel">
      <h2>Plazas en calle — {zone?.name ?? (zoneCode || "…")}</h2>
      <p className="panel-desc">
        Mapa en tiempo real. Verde = libre, rojo = ocupada, amarillo = reservada.
        Tocá una plaza en el mapa o en la lista para cambiar su estado.
      </p>

      {showZonePicker && zoneOptions.length > 1 && onZoneChange && (
        <label className="block-select-inline">
          Zona
          <SearchableSelect
            value={zoneCode}
            onChange={onZoneChange}
            options={zoneOptions}
          />
        </label>
      )}

      {error && <p className="form-error banner-error">{error}</p>}

      {loading && <p className="info-inline">Cargando plazas…</p>}

      {!loading && zoneCode && spots.length > 0 && (
        <p className="spot-status-count">
          <strong>{spots.length}</strong> plazas en la zona
        </p>
      )}

      {!loading && zoneCode && spots.length === 0 && (
        <p className="empty">No hay plazas registradas en esta zona.</p>
      )}

      {!loading && spots.length > 0 && (
        <>
          <BlockSpotFilter
            spots={spots}
            blocks={blocks}
            blockId={blockId}
            onBlockIdChange={setBlockId}
            disabled={Boolean(busyId)}
          />

          <div className="stat-grid compact-stats">
            <article className="stat-card">
              <span className="stat-val">{stats.free}</span>
              <span className="stat-lbl">Libres</span>
            </article>
            <article className="stat-card">
              <span className="stat-val">{stats.occupied}</span>
              <span className="stat-lbl">Ocupadas</span>
            </article>
            <article className="stat-card">
              <span className="stat-val">{stats.held}</span>
              <span className="stat-lbl">Reservadas</span>
            </article>
          </div>

          {displaySpots.length > 0 && (
            <>
              <SpotMap
                spots={displaySpots}
                mode="operate"
                center={mapCenter}
                height={460}
                referenceImageUrl={referenceImageUrl}
                imageBounds={defaultImageBounds(mapCenter)}
                onSpotToggle={toggleSpot}
                allowFullscreen
                hint="Verde = libre · Rojo = ocupada · Amarillo = reservada"
              />

              <SpotStatusGrid
                spots={displaySpots}
                disabled={Boolean(busyId)}
                onSpotClick={toggleSpot}
              />
            </>
          )}
        </>
      )}

      {busyId && <p className="info-inline">Actualizando plaza…</p>}
    </section>
  );
}
