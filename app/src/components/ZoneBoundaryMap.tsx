import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ParkingPolygon, ParkingZone } from "../types";
import { defaultImageBounds } from "../utils/spotMapStyles";
import {
  extractZonePolygonRings,
  polygonCenter,
  SALTA_CENTER,
} from "../utils/zoneGeo";

interface ZoneBoundaryMapProps {
  polygons: ParkingPolygon[];
  onPolygonsChange?: (polygons: ParkingPolygon[]) => void;
  otherZones?: ParkingZone[];
  referenceImageUrl?: string | null;
  height?: number;
  editable?: boolean;
  hint?: string;
}

function vertexIcon(color: string) {
  return L.divIcon({
    className: "zone-vertex-handle",
    html: `<span class="zone-vertex-dot" style="border-color:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function makeDraggableVertex(
  lat: number,
  lng: number,
  color: string,
  onDragEnd: (lat: number, lng: number) => void,
) {
  const marker = L.marker([lat, lng], {
    draggable: true,
    icon: vertexIcon(color),
    zIndexOffset: 1000,
  });
  marker.on("dragend", () => {
    const ll = marker.getLatLng();
    onDragEnd(ll.lat, ll.lng);
  });
  marker.on("click", L.DomEvent.stopPropagation);
  marker.on("mousedown", L.DomEvent.stopPropagation);
  marker.on("dblclick", L.DomEvent.stopPropagation);
  return marker;
}

export function ZoneBoundaryMap({
  polygons,
  onPolygonsChange,
  otherZones = [],
  referenceImageUrl,
  height = 380,
  editable = false,
  hint,
}: ZoneBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const otherLayerRef = useRef<L.LayerGroup | null>(null);
  const activeLayerRef = useRef<L.LayerGroup | null>(null);
  const vertexLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const onPolygonsChangeRef = useRef(onPolygonsChange);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  onPolygonsChangeRef.current = onPolygonsChange;

  const otherZoneOverlays = useMemo(
    () =>
      otherZones
        .map((z) => ({
          id: z.id,
          name: z.name,
          code: z.code,
          rings: extractZonePolygonRings(z),
        }))
        .filter((z) => z.rings.length > 0),
    [otherZones],
  );

  const savedRings = useMemo(
    () =>
      polygons
        .map((p) => extractZonePolygonRings({ polygons: [p] })[0])
        .filter((ring): ring is [number, number][] => Boolean(ring)),
    [polygons],
  );

  const mapCenter = useMemo((): [number, number] => {
    if (savedRings[0]?.length) return polygonCenter(savedRings[0]);
    if (draftPoints.length >= 1) return polygonCenter(draftPoints);
    if (otherZoneOverlays[0]?.rings[0]?.length) {
      return polygonCenter(otherZoneOverlays[0].rings[0]);
    }
    return SALTA_CENTER;
  }, [savedRings, draftPoints, otherZoneOverlays]);

  const fitBoundsLatLngs = useCallback((): L.LatLng[] => {
    const bounds: L.LatLng[] = [];
    for (const z of otherZoneOverlays) {
      for (const ring of z.rings) {
        ring.forEach(([lat, lng]) => bounds.push(L.latLng(lat, lng)));
      }
    }
    for (const ring of savedRings) {
      ring.forEach(([lat, lng]) => bounds.push(L.latLng(lat, lng)));
    }
    return bounds;
  }, [otherZoneOverlays, savedRings]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(SALTA_CENTER, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "",
    }).addTo(map);

    otherLayerRef.current = L.layerGroup().addTo(map);
    activeLayerRef.current = L.layerGroup().addTo(map);
    vertexLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      otherLayerRef.current = null;
      activeLayerRef.current = null;
      vertexLayerRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    if (referenceImageUrl) {
      overlayRef.current = L.imageOverlay(
        referenceImageUrl,
        defaultImageBounds(mapCenter, 120),
        { opacity: 0.45, interactive: false },
      ).addTo(map);
    }
  }, [referenceImageUrl, mapCenter]);

  useEffect(() => {
    const group = otherLayerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const z of otherZoneOverlays) {
      for (const ring of z.rings) {
        const latLngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
        L.polygon(latLngs, {
          color: "#64748b",
          weight: 2,
          fillColor: "#94a3b8",
          fillOpacity: 0.32,
          dashArray: "6 4",
          interactive: false,
        })
          .bindPopup(
            `<strong>${z.name}</strong><br/><code>${z.code}</code>`,
          )
          .addTo(group);

        L.marker(polygonCenter(ring), {
          interactive: false,
          icon: L.divIcon({
            className: "zone-map-label zone-map-label--muted",
            html: `<span>${z.name}</span>`,
            iconSize: [140, 22],
            iconAnchor: [70, 11],
          }),
        }).addTo(group);
      }
    }
  }, [otherZoneOverlays]);

  useEffect(() => {
    const group = activeLayerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const ring of savedRings) {
      const latLngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
      L.polygon(latLngs, {
        color: "#015cb4",
        weight: 3,
        fillColor: "#015cb4",
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(group);
    }

    if (draftPoints.length) {
      const draftLatLngs = draftPoints.map(([lat, lng]) => L.latLng(lat, lng));
      if (draftPoints.length >= 3) {
        L.polygon(draftLatLngs, {
          color: "#dc2626",
          weight: 2,
          fillColor: "#dc2626",
          fillOpacity: 0.12,
          dashArray: "6 4",
          interactive: false,
        }).addTo(group);
      }
      L.polyline(draftLatLngs, {
        color: "#dc2626",
        weight: 2,
        dashArray: "6 4",
        interactive: false,
      }).addTo(group);
    }
  }, [savedRings, draftPoints]);

  useEffect(() => {
    const group = vertexLayerRef.current;
    if (!group || !editable) return;
    group.clearLayers();

    draftPoints.forEach(([lat, lng], index) => {
      makeDraggableVertex(lat, lng, "#dc2626", (newLat, newLng) => {
        setDraftPoints((pts) =>
          pts.map((pt, i) => (i === index ? [newLat, newLng] : pt)),
        );
      }).addTo(group);
    });

    if (!draftPoints.length) {
      savedRings.forEach((ring, polyIndex) => {
        ring.forEach(([lat, lng], pointIndex) => {
          makeDraggableVertex(lat, lng, "#015cb4", (newLat, newLng) => {
            onPolygonsChangeRef.current?.(
              polygons.map((poly, pi) => {
                if (pi !== polyIndex) return poly;
                return {
                  points: poly.points.map((pt, idx) =>
                    idx === pointIndex ? [newLat, newLng] : pt,
                  ),
                };
              }),
            );
          }).addTo(group);
        });
      });
    }
  }, [draftPoints, savedRings, editable, polygons]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = fitBoundsLatLngs();
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 17 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(map.getZoom(), 16));
    }
  }, [otherZoneOverlays, savedRings, fitBoundsLatLngs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !draftPoints.length) return;
    const last = draftPoints[draftPoints.length - 1];
    const ll = L.latLng(last[0], last[1]);
    if (!map.getBounds().contains(ll)) {
      map.panTo(ll, { animate: true, duration: 0.25 });
    }
  }, [draftPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !editable || !onPolygonsChange) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      setDraftPoints((pts) => [...pts, [e.latlng.lat, e.latlng.lng]]);
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [editable, onPolygonsChange]);

  useEffect(() => {
    document.body.classList.toggle("map-fullscreen-active", fullscreen);
    return () => document.body.classList.remove("map-fullscreen-active");
  }, [fullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [height, fullscreen]);

  const mapHeight = fullscreen ? "calc(100vh - 10rem)" : height;

  function finishPolygon() {
    if (draftPoints.length < 3) return;
    onPolygonsChange?.([{ points: draftPoints }]);
    setDraftPoints([]);
  }

  function undoPoint() {
    setDraftPoints((pts) => pts.slice(0, -1));
  }

  function clearPolygon() {
    setDraftPoints([]);
    onPolygonsChange?.([]);
  }

  return (
    <div
      className={`spot-map-wrap zone-boundary-map${fullscreen ? " map-fullscreen" : ""}`}
    >
      <div className="spot-map-toolbar">
        <div className="spot-map-toolbar__row">
          {editable && (
            <>
              <button
                type="button"
                className="btn-small"
                onClick={finishPolygon}
                disabled={draftPoints.length < 3}
              >
                Cerrar polígono ({draftPoints.length} pts)
              </button>
              <button
                type="button"
                className="btn-small btn-ghost"
                onClick={undoPoint}
                disabled={!draftPoints.length}
              >
                Deshacer punto
              </button>
              <button
                type="button"
                className="btn-small btn-ghost"
                onClick={clearPolygon}
              >
                Borrar delimitación
              </button>
            </>
          )}
          <span className="spot-map-toolbar__spacer" aria-hidden />
          <button
            type="button"
            className="btn-small map-fullscreen-btn"
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
          </button>
        </div>
        {(hint || otherZoneOverlays.length > 0) && (
          <div className="spot-map-toolbar__row spot-map-toolbar__row--footer">
            {hint && <p className="spot-map-hint-inline">{hint}</p>}
            {otherZoneOverlays.length > 0 && (
              <div className="zone-boundary-legend zone-boundary-legend--inline">
                <span className="legend-item">
                  <i className="legend-swatch legend-swatch--other" />
                  Zonas existentes ({otherZoneOverlays.length})
                </span>
                <span className="legend-item">
                  <i className="legend-swatch legend-swatch--current" />
                  Tu zona
                </span>
                {draftPoints.length > 0 && (
                  <span className="legend-item">
                    <i className="legend-swatch legend-swatch--draft" />
                    Borrador — arrastrá los puntos
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        className="zones-map spot-map"
        style={{ height: mapHeight }}
        role="application"
        aria-label="Mapa de delimitación de zona"
      />
    </div>
  );
}
