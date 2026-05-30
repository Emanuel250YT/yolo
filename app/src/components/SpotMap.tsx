import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Spot } from "../types";
import { SALTA_CENTER } from "../utils/zoneGeo";
import {
  defaultImageBounds,
  resolveSpotLatLng,
  SPOT_STATUS_COLOR,
  SPOT_STATUS_LABEL,
  SPOT_TYPE_LABEL,
  spotStatusOf,
} from "../utils/spotMapStyles";

export type SpotMapMode = "overview" | "pick" | "manage" | "operate";

export interface BlockMapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  selected?: boolean;
}

export interface OtherZoneOverlay {
  name: string;
  code?: string;
  polygons: [number, number][][];
}

interface SpotMapProps {
  spots: Spot[];
  mode?: SpotMapMode;
  center?: [number, number];
  zoom?: number;
  height?: number;
  referenceImageUrl?: string | null;
  imageBounds?: [[number, number], [number, number]];
  zonePolygons?: [number, number][][];
  otherZones?: OtherZoneOverlay[];
  streetPoints?: [number, number][];
  streetPreviewPoints?: [number, number][];
  blockMarkers?: BlockMapMarker[];
  streetRadiusM?: number;
  pendingMarker?: { lat: number; lng: number } | null;
  selectedSpotId?: string | null;
  onSpotSelect?: (spot: Spot) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMapRightClick?: (lat: number, lng: number, spot?: Spot) => void;
  onSpotToggle?: (spot: Spot) => void;
  hint?: string;
  disabled?: boolean;
  allowFullscreen?: boolean;
  toolbar?: React.ReactNode;
  toolbarFooter?: React.ReactNode;
}

function spotIcon(spot: Spot, selected: boolean) {
  const status = spotStatusOf(spot);
  const color = SPOT_STATUS_COLOR[status] ?? "#64748b";
  const label = spot.label.replace(/^P-?/, "").slice(0, 4);
  const ring = selected ? "box-shadow:0 0 0 3px #015cb4;" : "";
  const mine = spot.heldByMe ? "border:2px solid #7c3aed;" : "";
  const free =
    spot.spotType === "gratuita"
      ? "outline:2px dashed #fff;outline-offset:1px;"
      : "";
  return L.divIcon({
    className: "spot-map-marker-wrap",
    html: `<span class="spot-map-marker status-${status}${spot.spotType === "gratuita" ? " spot-map-marker--free" : ""}" style="background:${color};${ring}${mine}${free}">${label}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function blockIcon(label: string, selected: boolean) {
  const ring = selected ? "box-shadow:0 0 0 3px #015cb4;" : "";
  return L.divIcon({
    className: "spot-map-marker-wrap",
    html: `<span class="block-map-marker" style="background:#334155;${ring}">${label.slice(0, 3)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function SpotMap({
  spots,
  mode = "overview",
  center,
  zoom = 18,
  height = 420,
  referenceImageUrl,
  imageBounds,
  zonePolygons = [],
  otherZones = [],
  streetPoints = [],
  streetPreviewPoints = [],
  blockMarkers = [],
  streetRadiusM = 120,
  pendingMarker,
  selectedSpotId,
  onSpotSelect,
  onMapClick,
  onMapRightClick,
  onSpotToggle,
  hint,
  disabled,
  allowFullscreen = true,
  toolbar,
  toolbarFooter,
}: SpotMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const otherZoneLayerRef = useRef<L.LayerGroup | null>(null);
  const streetLayerRef = useRef<L.LayerGroup | null>(null);
  const blockLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(
    null,
  );
  const rightClickHandlerRef = useRef<
    ((e: L.LeafletMouseEvent) => void) | null
  >(null);

  const mapCenter = useMemo((): [number, number] => {
    if (center) return center;
    if (zonePolygons.length) {
      const flat = zonePolygons.flat();
      if (flat.length) {
        const lat = flat.reduce((a, p) => a + p[0], 0) / flat.length;
        const lng = flat.reduce((a, p) => a + p[1], 0) / flat.length;
        return [lat, lng];
      }
    }
    const withCoords = spots.find((s) => s.lat != null && s.lng != null);
    if (withCoords?.lat != null && withCoords.lng != null) {
      return [withCoords.lat, withCoords.lng];
    }
    return SALTA_CENTER;
  }, [center, spots, zonePolygons]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(mapCenter, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "",
    }).addTo(map);

    zoneLayerRef.current = L.layerGroup().addTo(map);
    otherZoneLayerRef.current = L.layerGroup().addTo(map);
    streetLayerRef.current = L.layerGroup().addTo(map);
    blockLayerRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      zoneLayerRef.current = null;
      otherZoneLayerRef.current = null;
      streetLayerRef.current = null;
      blockLayerRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("map-fullscreen-active", fullscreen);
    return () => document.body.classList.remove("map-fullscreen-active");
  }, [fullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    const group = otherZoneLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    for (const z of otherZones) {
      for (const polygon of z.polygons) {
        if (polygon.length < 3) continue;
        const latLngs = polygon.map(([lat, lng]) => L.latLng(lat, lng));
        L.polygon(latLngs, {
          color: "#94a3b8",
          weight: 1,
          fillColor: "#cbd5e1",
          fillOpacity: 0.15,
          dashArray: "4 4",
          interactive: false,
        })
          .bindPopup(`<strong>${z.name}</strong>${z.code ? `<br/><code>${z.code}</code>` : ""}`)
          .addTo(group);
      }
    }
  }, [otherZones]);

  useEffect(() => {
    const group = streetLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (streetPoints.length >= 2) {
      const latLngs = streetPoints.map(([lat, lng]) => L.latLng(lat, lng));
      L.polyline(latLngs, {
        color: "#dc2626",
        weight: 4,
        opacity: 0.9,
      }).addTo(group);
    } else if (streetPoints.length === 1) {
      const [lat, lng] = streetPoints[0];
      L.circleMarker([lat, lng], {
        radius: 6,
        color: "#dc2626",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(group);
    }

    for (const [lat, lng] of streetPoints) {
      L.circleMarker([lat, lng], {
        radius: 4,
        color: "#dc2626",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(group);
    }

    for (const [lat, lng] of streetPreviewPoints) {
      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#16a34a",
        fillColor: "#86efac",
        fillOpacity: 0.85,
        weight: 2,
        dashArray: "2 2",
      }).addTo(group);
    }
  }, [streetPoints, streetPreviewPoints]);

  useEffect(() => {
    const map = mapRef.current;
    const group = zoneLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: L.LatLng[] = [];

    zonePolygons.forEach((polygon) => {
      if (polygon.length < 3) return;
      const latLngs = polygon.map(([lat, lng]) => L.latLng(lat, lng));
      latLngs.forEach((ll) => bounds.push(ll));
      L.polygon(latLngs, {
        color: "#015cb4",
        weight: 2,
        fillColor: "#015cb4",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);
    });

    if (bounds.length >= 3) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 18 });
    } else if (map.getZoom() < 16) {
      map.setView(mapCenter, zoom);
    }
  }, [zonePolygons, mapCenter, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    if (referenceImageUrl) {
      const bounds = imageBounds ?? defaultImageBounds(mapCenter);
      overlayRef.current = L.imageOverlay(referenceImageUrl, bounds, {
        opacity: 0.55,
        interactive: false,
      }).addTo(map);
    }
  }, [referenceImageUrl, imageBounds, mapCenter]);

  useEffect(() => {
    const group = blockLayerRef.current;
    if (!group) return;
    group.clearLayers();

    blockMarkers.forEach((block) => {
      if (block.lat == null || block.lng == null) return;
      const latLng = L.latLng(block.lat, block.lng);
      L.marker(latLng, {
        icon: blockIcon(block.label, Boolean(block.selected)),
        zIndexOffset: block.selected ? 800 : 400,
      })
        .bindPopup(`<strong>${block.label}</strong><br/>Calle / tramo`)
        .addTo(group);

      if (block.selected && streetRadiusM > 0) {
        L.circle(latLng, {
          radius: streetRadiusM,
          color: "#015cb4",
          weight: 1,
          fillColor: "#015cb4",
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(group);
      }
    });

    if (pendingMarker) {
      L.marker([pendingMarker.lat, pendingMarker.lng], {
        icon: L.divIcon({
          className: "spot-map-marker-wrap",
          html: `<span class="block-map-marker pending-marker">+</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 900,
      }).addTo(group);
    }
  }, [blockMarkers, pendingMarker, streetRadiusM]);

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const positions: L.LatLng[] = [];

    spots.forEach((spot, index) => {
      const [lat, lng] = resolveSpotLatLng(spot, index, mapCenter);
      const latLng = L.latLng(lat, lng);
      positions.push(latLng);

      const status = spotStatusOf(spot);
      const marker = L.marker(latLng, {
        icon: spotIcon(spot, selectedSpotId === spot.id),
        zIndexOffset: selectedSpotId === spot.id ? 1000 : status === "available" ? 500 : 0,
      });

      marker.bindPopup(
        `<strong>${spot.label}</strong><br/>${SPOT_STATUS_LABEL[status] ?? status}<br/>${SPOT_TYPE_LABEL[spot.spotType ?? "pago"] ?? spot.spotType}<br/>${spot.blockStreet || spot.address || ""}`,
      );

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (mode === "operate" && onSpotToggle) {
          onSpotToggle(spot);
          return;
        }
        if (mode === "pick" && status === "available" && onSpotSelect && !disabled) {
          onSpotSelect(spot);
          return;
        }
        if (mode === "manage" && onSpotSelect) {
          onSpotSelect(spot);
        }
      });

      if (mode === "manage" && onMapRightClick) {
        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);
          e.originalEvent.preventDefault();
          onMapRightClick(e.latlng.lat, e.latlng.lng, spot);
        });
      }

      marker.addTo(group);
    });

    if (!zonePolygons.length) {
      if (positions.length > 1) {
        map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 19 });
      } else if (positions.length === 1) {
        map.setView(positions[0], Math.max(zoom, 18));
      }
    }
  }, [spots, selectedSpotId, mode, mapCenter, onSpotSelect, onSpotToggle, onMapRightClick, zoom, disabled, zonePolygons.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
    if (rightClickHandlerRef.current) {
      map.off("contextmenu", rightClickHandlerRef.current);
      rightClickHandlerRef.current = null;
    }

    if (mode === "manage" && !disabled) {
      if (onMapClick) {
        const handler = (e: L.LeafletMouseEvent) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        };
        clickHandlerRef.current = handler;
        map.on("click", handler);
      }
      if (onMapRightClick) {
        const handler = (e: L.LeafletMouseEvent) => {
          e.originalEvent.preventDefault();
          onMapRightClick(e.latlng.lat, e.latlng.lng);
        };
        rightClickHandlerRef.current = handler;
        map.on("contextmenu", handler);
      }
    }

    return () => {
      if (clickHandlerRef.current && map) {
        map.off("click", clickHandlerRef.current);
      }
      if (rightClickHandlerRef.current && map) {
        map.off("contextmenu", rightClickHandlerRef.current);
      }
    };
  }, [mode, onMapClick, onMapRightClick, disabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [height, fullscreen]);

  const mapHeight = fullscreen ? "calc(100vh - 8rem)" : height;

  return (
    <div
      className={`spot-map-wrap${fullscreen ? " map-fullscreen" : ""}`}
    >
      <div className="spot-map-toolbar">
        <div className="spot-map-toolbar__row">
          {toolbar}
          <span className="spot-map-toolbar__spacer" aria-hidden />
          {allowFullscreen && (
            <button
              type="button"
              className="btn-small map-fullscreen-btn"
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
            </button>
          )}
        </div>
        {(toolbarFooter || hint) && (
          <div className="spot-map-toolbar__row spot-map-toolbar__row--footer">
            {toolbarFooter}
            {hint && <p className="spot-map-hint-inline">{hint}</p>}
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        className="spot-map zones-map"
        style={{ height: mapHeight }}
        role="application"
        aria-label="Mapa de plazas de estacionamiento"
      />
      <div className="zones-map-legend spot-map-legend">
        {otherZones.length > 0 && (
          <span className="legend-item">
            <i style={{ background: "#94a3b8", opacity: 0.6 }} />
            Otras zonas
          </span>
        )}
        {zonePolygons.length > 0 && (
          <span className="legend-item">
            <i style={{ background: "#015cb4", opacity: 0.5 }} />
            Zona activa
          </span>
        )}
        {streetPoints.length > 0 && (
          <span className="legend-item">
            <i style={{ background: "#dc2626" }} />
            Tramo calle
          </span>
        )}
        {streetPreviewPoints.length > 0 && (
          <span className="legend-item">
            <i style={{ background: "#16a34a" }} />
            Vista previa plazas
          </span>
        )}
        <span className="legend-title">Plazas</span>
        <span className="legend-item">
          <i style={{ background: "#22c55e", outline: "2px dashed #fff" }} />
          Gratuita (libre)
        </span>
        {Object.entries(SPOT_STATUS_LABEL).map(([key, label]) => (
          <span key={key} className="legend-item">
            <i style={{ background: SPOT_STATUS_COLOR[key] }} />
            {label}
          </span>
        ))}
        {blockMarkers.length > 0 && (
          <span className="legend-item">
            <i style={{ background: "#334155" }} />
            Calle / tramo
          </span>
        )}
        {mode === "manage" && (
          <span className="legend-item map-mode-hint">
            Clic izquierdo: agregar · Clic derecho: quitar
          </span>
        )}
      </div>
    </div>
  );
}
