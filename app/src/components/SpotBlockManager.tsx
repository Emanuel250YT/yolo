import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, LinkedRef, RefCell, TableActions } from "./DataTable";
import { SearchableSelect } from "./SearchableSelect";
import { SpotMap } from "./SpotMap";
import { formatRef } from "../utils/formatRef";
import type { EntityNavTarget } from "../utils/entityNav";
import {
  distanceMeters,
  pointInAnyPolygon,
  SALTA_CENTER,
  zoneGeoFromParkingZone,
} from "../utils/zoneGeo";
import { defaultImageBounds } from "../utils/spotMapStyles";
import type { ParkingZone, Spot } from "../types";

const NEAR_SPOT_M = 25;

interface SpotBlockManagerProps {
  navTarget?: EntityNavTarget | null;
  onNavHandled?: () => void;
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
  navTarget,
  onNavHandled,
}: SpotBlockManagerProps) {
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [zoneDetail, setZoneDetail] = useState<ParkingZone | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  );
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [z, s] = await Promise.all([
        api.adminParkingZones(),
        api.adminSpotsLive(),
      ]);
      setZones(z.zones);
      setSpots(s.spots);
      setZoneId((prev) => prev || z.zones[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!zoneId) {
      setZoneDetail(null);
      setReferenceImageUrl(null);
      return;
    }
    api
      .adminParkingZone(zoneId)
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
  }, [zoneId]);

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

  function validateInZone(lat: number, lng: number): boolean {
    if (!hasZoneBoundary) {
      setError(
        "La zona no tiene polígono definido. Definilo en Zonas antes de marcar plazas.",
      );
      return false;
    }
    if (!pointInAnyPolygon(lat, lng, zonePolygons)) {
      setError("La plaza debe estar dentro del límite de la zona seleccionada.");
      return false;
    }
    return true;
  }

  async function refreshSpots() {
    const { spots: live } = await api.adminSpotsLive();
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
      await api.adminCreateSpotInZone(zoneId, { lat, lng });
      await refreshSpots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear plaza");
    }
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
      await api.adminDeleteSpot(target.id, true);
      if (selectedSpotId === target.id) setSelectedSpotId(null);
      await refreshSpots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar plaza");
    }
  }

  return (
    <div className="sector-map-layout">
      {error && <p className="form-error banner-error">{error}</p>}

      <section className="panel">
        <h2>Plazas</h2>
        <p className="panel-desc">
          Seleccioná una zona para ver su límite en el mapa. Clic izquierdo para
          agregar plazas dentro de la zona; clic derecho para quitarlas.
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
        </div>

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

        <SpotMap
          spots={zoneSpots}
          mode="manage"
          center={mapCenter}
          height={520}
          referenceImageUrl={referenceImageUrl}
          imageBounds={defaultImageBounds(mapCenter)}
          zonePolygons={zonePolygons}
          selectedSpotId={selectedSpotId}
          onMapClick={hasZoneBoundary ? addSpotAt : undefined}
          onMapRightClick={removeSpotAt}
          onSpotSelect={(s) => setSelectedSpotId(s.id)}
          disabled={!hasZoneBoundary || !zoneId}
          hint={
            hasZoneBoundary
              ? "Clic izquierdo: nueva plaza dentro de la zona. Clic derecho sobre una plaza (o cerca): eliminar."
              : "Definí el polígono de la zona en la pestaña Zonas para poder marcar plazas."
          }
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
