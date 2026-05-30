import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, LinkedRef, RefCell, TableActions } from "./DataTable";
import { SearchableSelect } from "./SearchableSelect";
import { SpotMap } from "./SpotMap";
import { formatRef } from "../utils/formatRef";
import type { EntityNavTarget } from "../utils/entityNav";
import {
  estimateSpotCount,
  formatMeters,
} from "../utils/polylineSpots";
import {
  distanceMeters,
  pointInAnyPolygon,
  pointsAlongPolyline,
  polylineLengthMeters,
  SALTA_CENTER,
  zoneGeoFromParkingZone,
} from "../utils/zoneGeo";
import { defaultImageBounds } from "../utils/spotMapStyles";
import type { ParkingZone, Spot } from "../types";

const NEAR_SPOT_M = 25;
const SPOT_SPACING_M = 5;

type MapTool = "point" | "street";
type SpotsApiMode = "admin" | "municipio";

interface SpotBlockManagerProps {
  apiMode?: SpotsApiMode;
  navTarget?: EntityNavTarget | null;
  onNavHandled?: () => void;
}

function spotsApi(mode: SpotsApiMode) {
  if (mode === "municipio") {
    return {
      listZones: () => api.municipioParkingZones(),
      getZone: (id: string) => api.municipioParkingZone(id),
      listSpotsLive: () => api.municipioSpotsLive(),
      createSpot: (
        zoneId: string,
        payload: { lat: number; lng: number; label?: string },
      ) => api.municipioCreateSpotInZone(zoneId, payload),
      createSpotsAlongLine: (
        zoneId: string,
        payload: {
          points: { lat: number; lng: number }[];
          spacingM?: number;
        },
      ) => api.municipioCreateSpotsAlongLine(zoneId, payload),
      deleteSpot: (id: string, force?: boolean) =>
        api.municipioDeleteSpot(id, force),
    };
  }
  return {
    listZones: () => api.adminParkingZones(),
    getZone: (id: string) => api.adminParkingZone(id),
    listSpotsLive: () => api.adminSpotsLive(),
    createSpot: (
      zoneId: string,
      payload: { lat: number; lng: number; label?: string },
    ) => api.adminCreateSpotInZone(zoneId, payload),
    createSpotsAlongLine: (
      zoneId: string,
      payload: {
        points: { lat: number; lng: number }[];
        spacingM?: number;
      },
    ) => api.adminCreateSpotsAlongLine(zoneId, payload),
    deleteSpot: (id: string, force?: boolean) =>
      api.adminDeleteSpot(id, force),
  };
}

function nearestSpot(
  lat: number,
  lng: number,
  spots: Spot[],
  maxM: number,
): Spot | null {
  let best: Spot | null = null;
  let bestDist = maxM;
  for (const spot of spots) {
    if (spot.lat == null || spot.lng == null) continue;
    const d = distanceMeters([lat, lng], [spot.lat, spot.lng]);
    if (d <= bestDist) {
      bestDist = d;
      best = spot;
    }
  }
  return best;
}

export function SpotBlockManager({
  apiMode = "admin",
  navTarget,
  onNavHandled,
}: SpotBlockManagerProps) {
  const spotsApiClient = useMemo(() => spotsApi(apiMode), [apiMode]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [zoneDetail, setZoneDetail] = useState<ParkingZone | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapTool, setMapTool] = useState<MapTool>("point");
  const [streetPoints, setStreetPoints] = useState<[number, number][]>([]);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [z, s] = await Promise.all([
        spotsApiClient.listZones(),
        spotsApiClient.listSpotsLive(),
      ]);
      setZones(z.zones);
      setSpots(s.spots);
      setZoneId((prev) => prev || z.zones[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, [spotsApiClient]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!zoneId) {
      setZoneDetail(null);
      setReferenceImageUrl(null);
      return;
    }
    spotsApiClient
      .getZone(zoneId)
      .then(({ zone }) => {
        setZoneDetail(zone);
        if (zone.imageBase64 && zone.imageMimeType) {
          setReferenceImageUrl(
            `data:${zone.imageMimeType};base64,${zone.imageBase64}`,
          );
        } else {
          setReferenceImageUrl(null);
        }
      })
      .catch(() => {
        setZoneDetail(null);
        setReferenceImageUrl(null);
      });
  }, [zoneId, spotsApiClient]);

  useEffect(() => {
    setStreetPoints([]);
  }, [zoneId, mapTool]);

  useEffect(() => {
    if (!navTarget) return;
    if (navTarget.kind === "zone") {
      const z =
        zones.find(
          (x) =>
            formatRef(x) === navTarget.ref ||
            x.id === navTarget.id ||
            x.id === navTarget.ref,
        ) ?? null;
      if (z) {
        setZoneId(z.id);
        onNavHandled?.();
      }
      return;
    }
    if (navTarget.kind === "spot") {
      const s =
        spots.find(
          (x) =>
            formatRef(x) === navTarget.ref ||
            x.id === navTarget.id ||
            x.id === navTarget.ref,
        ) ?? null;
      if (s) {
        if (s.parkingZoneId) setZoneId(s.parkingZoneId);
        setSelectedSpotId(s.id);
        onNavHandled?.();
      }
    }
  }, [navTarget, zones, spots, onNavHandled]);

  const selectedZone = zones.find((z) => z.id === zoneId) ?? zoneDetail;

  const zonePolygons = useMemo((): [number, number][][] => {
    const source = zoneDetail ?? selectedZone;
    if (!source?.polygons?.length) return [];
    return source.polygons
      .filter((p) => p.points.length >= 3)
      .map((p) =>
        p.points.map(
          ([lat, lng]) => [Number(lat), Number(lng)] as [number, number],
        ),
      );
  }, [zoneDetail, selectedZone]);

  const otherZones = useMemo(() => {
    return zones
      .filter((z) => z.id !== zoneId)
      .map((z) => ({
        name: z.name,
        code: z.code,
        polygons: (z.polygons ?? [])
          .filter((p) => p.points.length >= 3)
          .map((p) =>
            p.points.map(
              ([lat, lng]) => [Number(lat), Number(lng)] as [number, number],
            ),
          ),
      }))
      .filter((z) => z.polygons.length > 0);
  }, [zones, zoneId]);

  const hasZoneBoundary = zonePolygons.length > 0;

  const zoneSpots = useMemo(
    () =>
      spots.filter(
        (s) => s.parkingZoneId === zoneId || s.zone === selectedZone?.code,
      ),
    [spots, zoneId, selectedZone?.code],
  );

  const zoneSpotStats = useMemo(() => {
    const occupied = zoneSpots.filter((s) => s.status === "occupied").length;
    const held = zoneSpots.filter((s) => s.status === "held").length;
    const available = zoneSpots.filter((s) => s.status === "available").length;
    return { total: zoneSpots.length, occupied, held, available };
  }, [zoneSpots]);

  const mapCenter = useMemo((): [number, number] => {
    const geo = selectedZone ? zoneGeoFromParkingZone(selectedZone) : null;
    if (geo) return geo.center;
    return SALTA_CENTER;
  }, [selectedZone]);

  const streetLengthM = useMemo(
    () => polylineLengthMeters(streetPoints),
    [streetPoints],
  );

  const streetPreviewPoints = useMemo(() => {
    if (streetPoints.length < 2) return [];
    return pointsAlongPolyline(streetPoints, SPOT_SPACING_M);
  }, [streetPoints]);

  const streetSpotEstimate = useMemo(
    () => estimateSpotCount(streetPoints, SPOT_SPACING_M),
    [streetPoints],
  );

  function validateInZone(lat: number, lng: number): boolean {
    if (!hasZoneBoundary) {
      setError(
        "La zona no tiene polígono definido. Definilo en Zonas antes de marcar plazas.",
      );
      return false;
    }
    if (!pointInAnyPolygon(lat, lng, zonePolygons)) {
      setError("El punto debe estar dentro del límite de la zona seleccionada.");
      return false;
    }
    return true;
  }

  async function refreshSpots() {
    const { spots: live } = await spotsApiClient.listSpotsLive();
    setSpots(live);
  }

  async function addSpotAt(lat: number, lng: number) {
    if (!zoneId) {
      setError("Seleccioná una zona.");
      return;
    }
    if (!validateInZone(lat, lng)) return;
    setError(null);
    try {
      await spotsApiClient.createSpot(zoneId, { lat, lng });
      await refreshSpots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear plaza");
    }
  }

  function handleMapClick(lat: number, lng: number) {
    if (mapTool === "street") {
      if (!validateInZone(lat, lng)) return;
      setError(null);
      setStreetPoints((pts) => [...pts, [lat, lng]]);
      return;
    }
    void addSpotAt(lat, lng);
  }

  async function removeSpotAt(lat: number, lng: number, spot?: Spot) {
    const target =
      spot ?? nearestSpot(lat, lng, zoneSpots, NEAR_SPOT_M);
    if (!target) {
      setError("No hay ninguna plaza cerca de ese punto.");
      return;
    }
    setError(null);
    try {
      await spotsApiClient.deleteSpot(target.id, true);
      if (selectedSpotId === target.id) setSelectedSpotId(null);
      await refreshSpots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar plaza");
    }
  }

  async function generateSpotsAlongStreet() {
    if (!zoneId) {
      setError("Seleccioná una zona.");
      return;
    }
    if (streetPoints.length < 2) {
      setError("Marcá al menos 2 puntos del tramo de calle en el mapa.");
      return;
    }
    if (streetPreviewPoints.some(([lat, lng]) => !pointInAnyPolygon(lat, lng, zonePolygons))) {
      setError("Todo el tramo debe quedar dentro de la zona seleccionada.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { created, lengthM } = await spotsApiClient.createSpotsAlongLine(
        zoneId,
        {
          points: streetPoints.map(([lat, lng]) => ({ lat, lng })),
          spacingM: SPOT_SPACING_M,
        },
      );
      setStreetPoints([]);
      await refreshSpots();
      setSuccess(
        `Se crearon ${created} plazas a lo largo de ${formatMeters(lengthM)} (cada ${SPOT_SPACING_M} m).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar plazas");
    } finally {
      setGenerating(false);
    }
  }

  const mapHint =
    mapTool === "street"
      ? hasZoneBoundary
        ? "Modo calle: clic en el mapa para marcar inicio y fin del tramo (podés usar varios puntos). Largo estimado y plazas cada 5 m."
        : "Definí el polígono de la zona en la pestaña Zonas."
      : hasZoneBoundary
        ? "Modo punto: clic izquierdo para agregar plazas; clic derecho para quitar."
        : "Definí el polígono de la zona en la pestaña Zonas para poder marcar plazas.";

  return (
    <div className="sector-map-layout">
      {error && <p className="form-error banner-error">{error}</p>}
      {success && <p className="form-success banner-success">{success}</p>}

      <section className="panel">
        <h2>Plazas</h2>
        <p className="panel-desc">
          Seleccioná una zona y usá el mapa para marcar plazas. Las demás zonas
          existentes se muestran en gris como referencia.
        </p>

        <div className="sector-map-toolbar form-grid">
          <label>
            Zona *
            <SearchableSelect
              required
              value={zoneId}
              onChange={(id) => {
                setZoneId(id);
                setSelectedSpotId(null);
              }}
              options={zones.map((z) => ({
                value: z.id,
                label: `${formatRef(z)} · ${z.name}`,
              }))}
              searchPlaceholder="Buscar zona…"
            />
          </label>
          <label>
            Herramienta
            <select
              value={mapTool}
              onChange={(e) => setMapTool(e.target.value as MapTool)}
            >
              <option value="point">Plaza individual (clic)</option>
              <option value="street">Tramo de calle (cada 5 m)</option>
            </select>
          </label>
        </div>

        {zones.length > 0 && (
          <div className="existing-zones-panel">
            <span className="existing-zones-label">
              Zonas existentes ({zones.length}):
            </span>
            <ul className="existing-zones-chips">
              {zones.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    className={`zone-chip${z.id === zoneId ? " zone-chip--active" : ""}`}
                    onClick={() => {
                      setZoneId(z.id);
                      setSelectedSpotId(null);
                    }}
                  >
                    <strong>{formatRef(z)}</strong> {z.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedZone && (
          <p className="info-inline">
            Zona{" "}
            <RefCell refId={formatRef(selectedZone)} entityKind="zone" /> ·{" "}
            <strong>{selectedZone.name}</strong> · {zoneSpotStats.total} plazas
            ({zoneSpotStats.available} libres, {zoneSpotStats.occupied} ocupadas
            {zoneSpotStats.held > 0 ? `, ${zoneSpotStats.held} en hold` : ""})
            {!hasZoneBoundary && (
              <span className="meta"> · Sin polígono — definilo en Zonas</span>
            )}
          </p>
        )}

        {mapTool === "street" && streetPoints.length > 0 && (
          <div className="street-tramo-bar">
            <span>
              Tramo: <strong>{formatMeters(streetLengthM)}</strong> · ~
              <strong>{streetSpotEstimate}</strong> plazas (cada {SPOT_SPACING_M}{" "}
              m)
            </span>
            <div className="street-tramo-actions">
              <button
                type="button"
                className="btn-small btn-ghost"
                onClick={() => setStreetPoints((pts) => pts.slice(0, -1))}
                disabled={!streetPoints.length || generating}
              >
                Deshacer punto
              </button>
              <button
                type="button"
                className="btn-small btn-ghost"
                onClick={() => setStreetPoints([])}
                disabled={!streetPoints.length || generating}
              >
                Limpiar tramo
              </button>
              <button
                type="button"
                className="btn-small btn-primary"
                onClick={() => void generateSpotsAlongStreet()}
                disabled={
                  streetPoints.length < 2 || generating || !hasZoneBoundary
                }
              >
                {generating
                  ? "Generando…"
                  : `Generar ${streetSpotEstimate} plazas`}
              </button>
            </div>
          </div>
        )}

        <SpotMap
          spots={zoneSpots}
          mode="manage"
          center={mapCenter}
          height={520}
          referenceImageUrl={referenceImageUrl}
          imageBounds={defaultImageBounds(mapCenter)}
          zonePolygons={zonePolygons}
          otherZones={otherZones}
          streetPoints={mapTool === "street" ? streetPoints : []}
          streetPreviewPoints={
            mapTool === "street" ? streetPreviewPoints : []
          }
          selectedSpotId={selectedSpotId}
          onMapClick={hasZoneBoundary ? handleMapClick : undefined}
          onMapRightClick={mapTool === "point" ? removeSpotAt : undefined}
          onSpotSelect={(s) => setSelectedSpotId(s.id)}
          disabled={!hasZoneBoundary || !zoneId}
          hint={mapHint}
        />
      </section>

      {selectedZone && (
        <section className="panel">
          <h3>Plazas en {selectedZone.name}</h3>
          <DataTable
            rows={zoneSpots}
            rowKey={(s) => s.id}
            selectedKey={selectedSpotId}
            searchPlaceholder="Buscar plaza…"
            emptyMessage="Marcá plazas en el mapa con clic izquierdo."
            filters={[
              {
                key: "status",
                label: "Estado",
                options: [
                  { value: "available", label: "Disponible" },
                  { value: "occupied", label: "Ocupada" },
                  { value: "held", label: "En hold" },
                ],
              },
            ]}
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (s) => [s.ref, s.id, s.label],
                render: (s) => (
                  <RefCell refId={formatRef(s)} entityKind="spot" />
                ),
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (s) => [s.zone],
                render: () => (
                  <LinkedRef
                    label="Zona"
                    refId={formatRef(selectedZone)}
                    entityKind="zone"
                  />
                ),
              },
              {
                key: "label",
                header: "Etiqueta",
                searchValues: (s) => [s.label, s.address],
                render: (s) => s.label,
              },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (s) => [s.status],
                render: (s) => (
                  <span className="chip">{s.status ?? "available"}</span>
                ),
              },
              {
                key: "actions",
                header: "Acciones",
                render: (s) => (
                  <TableActions>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => setSelectedSpotId(s.id)}
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      className="btn-small btn-danger"
                      onClick={() =>
                        void removeSpotAt(s.lat ?? 0, s.lng ?? 0, s)
                      }
                    >
                      Eliminar
                    </button>
                  </TableActions>
                ),
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
