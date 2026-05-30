import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useGeolocation } from "../hooks/useGeolocation";
import { pickNearestAvailableSpot } from "../utils/geo";
import { SALTA_CENTER } from "../utils/zoneGeo";
import { spotStatusOf } from "../utils/spotMapStyles";
import { SpotMap } from "./SpotMap";
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
    if (!zoneCode) return;
    setError(null);
    try {
      const [s, b] = await Promise.all([
        api.permisionarioSpotsLive({ zone: zoneCode }),
        api.permisionarioBlocks(),
      ]);
      setSpots(s.spots);
      const zoneBlocks = b.blocks.filter((x) => x.zoneCode === zoneCode);
      setBlocks(zoneBlocks);
      setBlockId((prev) => {
        if (prev && zoneBlocks.some((x) => x.id === prev)) return prev;
        return zoneBlocks[0]?.id ?? "";
      });
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
      if (nearest.blockId) setBlockId(nearest.blockId);
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
  }, [zoneCode]);

  const selectedBlock = blocks.find((b) => b.id === blockId);
  const blockSpots = useMemo(
    () => spots.filter((s) => s.blockId === blockId),
    [spots, blockId],
  );

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
    return SALTA_CENTER;
  }, [spots, selectedSpotId, geo.lat, geo.lng, selectedBlock]);

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;

  function handleSpotSelect(spot: Spot) {
    if (spotStatusOf(spot) !== "available") return;
    spotTouched.current = true;
    onSpotChange(spot.id, spot);
  }

  return (
    <div className="permit-spot-picker">
      <div className="permit-spot-picker-head">
        <h3 className="permit-spot-picker-title">Plaza del vehículo</h3>
        <p className="panel-desc">
          Se selecciona automáticamente la plaza libre más cercana a tu
          ubicación. Podés elegir otra tocando el mapa.
        </p>
      </div>

      {geo.loading && (
        <p className="permit-spot-geo-hint">Obteniendo ubicación…</p>
      )}
      {geo.error && (
        <p className="permit-spot-geo-hint muted">
          Sin GPS: se usa la primera plaza libre disponible.
        </p>
      )}

      {selectedSpot && (
        <p className="permit-spot-selected">
          Plaza seleccionada: <strong>{selectedSpot.label}</strong>
          {selectedSpot.address ? ` · ${selectedSpot.address}` : ""}
        </p>
      )}

      {!selectedSpot && !loading && (
        <p className="form-error">No hay plazas libres en esta zona.</p>
      )}

      {error && <p className="form-error">{error}</p>}

      {blocks.length > 1 && (
        <label className="block-select-inline">
          Cuadra
          <select
            value={blockId}
            disabled={disabled}
            onChange={(e) => setBlockId(e.target.value)}
          >
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!loading && blockSpots.length > 0 && (
        <SpotMap
          spots={blockSpots}
          mode="pick"
          center={mapCenter}
          height={280}
          referenceImageUrl={referenceImageUrl}
          selectedSpotId={selectedSpotId}
          onSpotSelect={handleSpotSelect}
          disabled={disabled}
          hint="Tocá una plaza verde para seleccionarla"
        />
      )}
    </div>
  );
}
