import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { SpotMap } from "./SpotMap";
import { defaultImageBounds, spotStatusOf } from "../utils/spotMapStyles";
import { SALTA_CENTER } from "../utils/zoneGeo";
import type { ParkingBlock, ParkingZone, Spot } from "../types";

interface PermisionarioSpotPanelProps {
  zoneCode: string;
  zones: ParkingZone[];
}

export function PermisionarioSpotPanel({
  zoneCode,
  zones,
}: PermisionarioSpotPanelProps) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [blocks, setBlocks] = useState<ParkingBlock[]>([]);
  const [blockId, setBlockId] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const zone = zones.find((z) => z.code === zoneCode);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, b] = await Promise.all([
        api.permisionarioSpotsLive({ zone: zoneCode || undefined }),
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
    }
  }, [zoneCode]);

  useEffect(() => {
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

  const selectedBlock = blocks.find((b) => b.id === blockId);
  const blockSpots = useMemo(
    () => spots.filter((s) => s.blockId === blockId),
    [spots, blockId],
  );

  const mapCenter = useMemo((): [number, number] => {
    if (selectedBlock?.lat != null && selectedBlock.lng != null) {
      return [selectedBlock.lat, selectedBlock.lng];
    }
    return SALTA_CENTER;
  }, [selectedBlock]);

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
    free: blockSpots.filter((s) => spotStatusOf(s) === "available").length,
    occupied: blockSpots.filter((s) => spotStatusOf(s) === "occupied").length,
    held: blockSpots.filter((s) => spotStatusOf(s) === "held").length,
  };

  return (
    <section className="panel">
      <h2>Plazas en calle — {zone?.name ?? zoneCode}</h2>
      <p className="panel-desc">
        Mapa en tiempo real. Tocá una plaza para marcarla{" "}
        <strong>ocupada</strong> o <strong>libre</strong> de forma visual.
      </p>

      {error && <p className="form-error banner-error">{error}</p>}

      {blocks.length > 1 && (
        <label className="block-select-inline">
          Cuadra
          <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <SpotMap
        spots={blockSpots}
        mode="operate"
        center={mapCenter}
        height={460}
        referenceImageUrl={referenceImageUrl}
        imageBounds={defaultImageBounds(mapCenter)}
        onSpotToggle={toggleSpot}
        hint="Verde = libre · Rojo = ocupada · Amarillo = reservada por conductor"
      />

      {busyId && <p className="info-inline">Actualizando plaza…</p>}
    </section>
  );
}
