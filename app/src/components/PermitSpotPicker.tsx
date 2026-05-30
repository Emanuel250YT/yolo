import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useGeolocation } from "../hooks/useGeolocation";
import { pickNearestAvailableSpot } from "../utils/geo";
import { filterSpotsByBlock } from "../utils/spotFilters";
import { SALTA_CENTER } from "../utils/zoneGeo";
import { spotStatusOf } from "../utils/spotMapStyles";
import { BlockSpotFilter } from "./BlockSpotFilter";
import { SpotMap } from "./SpotMap";
import { SpotStatusGrid } from "./SpotStatusGrid";
import type { ParkingBlock, ParkingZone, Spot } from "../types";

interface PermitSpotPickerProps {
  zoneCode: string;
  zones: ParkingZone[];
  selectedSpotId: string | null;
  onSpotChange: (spotId: string | null, spot: Spot | null) => void;
  disabled?: boolean;
}

export function PermitSpotPicker({
  zoneCode,
  zones,
  selectedSpotId,
  onSpotChange,
  disabled,
}: PermitSpotPickerProps) {
  const geo = useGeolocation(true);
  const spotTouched = useRef(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [blocks, setBlocks] = useState<ParkingBlock[]>([]);
  const [blockId, setBlockId] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    void load();
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

  const availableSpots = useMemo(
    () => spots.filter((s) => spotStatusOf(s) === "available"),
    [spots],
  );

  useEffect(() => {
    if (spotTouched.current || loading || !availableSpots.length) return;

    const lat = geo.lat;
    const lng = geo.lng;
    const nearest =
      lat != null && lng != null
        ? pickNearestAvailableSpot(availableSpots, lat, lng)
        : availableSpots[0] ?? null;

    if (nearest && nearest.id !== selectedSpotId) {
      onSpotChange(nearest.id, nearest);
    }
  }, [
    availableSpots,
    geo.lat,
    geo.lng,
    loading,
    onSpotChange,
    selectedSpotId,
  ]);

  useEffect(() => {
    spotTouched.current = false;
    setBlockId("");
  }, [zoneCode]);

  const selectedBlock = blocks.find((b) => b.id === blockId);

  const mapCenter = useMemo((): [number, number] => {
    const selected = spots.find((s) => s.id === selectedSpotId);
    if (selected?.lat != null && selected.lng != null) {
      return [selected.lat, selected.lng];
    }
    if (geo.lat != null && geo.lng != null) {
      return [geo.lat, geo.lng];
    }
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
  }, [spots, selectedSpotId, geo.lat, geo.lng, selectedBlock, displaySpots]);

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;

  function handleSpotSelect(spot: Spot) {
    if (spotStatusOf(spot) !== "available") return;
    spotTouched.current = true;
    onSpotChange(spot.id, spot);
  }

  if (!zoneCode) {
    return (
      <div className="cinema-picker">
        <h3 className="cinema-picker-title">Plaza del vehículo</h3>
        <p className="panel-desc">Seleccioná una zona para ver las plazas disponibles.</p>
      </div>
    );
  }

  const freeCount = availableSpots.length;

  return (
    <div className="cinema-picker">
      <h3 className="cinema-picker-title">Plaza del vehículo</h3>
      <p className="panel-desc">
        Se preselecciona la plaza libre más cercana a tu ubicación
        {zone ? ` en ${zone.name}` : ""}. Podés elegir otra en el mapa o la lista.
      </p>

      {loading && <p className="info-inline">Cargando plazas…</p>}

      {!loading && spots.length > 0 && (
        <p className="spot-status-count">
          <strong>{spots.length}</strong> plazas en la zona ·{" "}
          <strong>{freeCount}</strong> libres
        </p>
      )}

      {geo.loading && (
        <p className="info-inline">Obteniendo ubicación…</p>
      )}
      {geo.error && (
        <p className="info-inline muted">
          Sin GPS: se usa la primera plaza libre disponible.
        </p>
      )}

      {selectedSpot && (
        <p className="selected-spot-bar">
          Plaza seleccionada: <strong>{selectedSpot.label}</strong>
          {selectedSpot.address ? ` · ${selectedSpot.address}` : ""}
        </p>
      )}

      {!loading && spots.length === 0 && (
        <p className="form-error">No hay plazas registradas en esta zona.</p>
      )}

      {!loading && spots.length > 0 && freeCount === 0 && (
        <p className="form-error">
          Todas las plazas están ocupadas o reservadas.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      {!loading && spots.length > 0 && (
        <BlockSpotFilter
          spots={spots}
          blocks={blocks}
          blockId={blockId}
          onBlockIdChange={setBlockId}
          disabled={disabled}
        />
      )}

      {!loading && displaySpots.length > 0 && (
        <>
          <SpotMap
            spots={displaySpots}
            mode="pick"
            center={mapCenter}
            height={280}
            referenceImageUrl={referenceImageUrl}
            selectedSpotId={selectedSpotId}
            onSpotSelect={handleSpotSelect}
            disabled={disabled}
            hint="Verde = libre · Rojo = ocupada · Tocá una verde para seleccionar"
          />
          <SpotStatusGrid
            spots={displaySpots}
            selectedSpotId={selectedSpotId}
            pickMode
            disabled={disabled}
            onSpotClick={handleSpotSelect}
          />
        </>
      )}
    </div>
  );
}
