import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ParkingPolygon, ParkingZone } from "../types";
import { defaultImageBounds } from "../utils/spotMapStyles";
import { SALTA_CENTER, polygonCenter } from "../utils/zoneGeo";

interface ZoneBoundaryMapProps {
  polygons: ParkingPolygon[];
  onPolygonsChange?: (polygons: ParkingPolygon[]) => void;
  otherZones?: ParkingZone[];
  referenceImageUrl?: string | null;
  height?: number;
  editable?: boolean;
  hint?: string;
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
  const layerRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);

  const mapCenter = useMemo((): [number, number] => {
    if (polygons[0]?.points?.length >= 3) {
      return polygonCenter(polygons[0].points);
    }
    if (draftPoints.length >= 1) {
      return polygonCenter(draftPoints);
    }
    return SALTA_CENTER;
  }, [polygons, draftPoints]);

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

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (polygons[0]?.points?.length >= 3 || draftPoints.length >= 1) {
      map.setView(mapCenter, map.getZoom() < 14 ? 15 : map.getZoom());
    }
  }, [mapCenter, polygons, draftPoints]);

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
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: L.LatLng[] = [];

    for (const z of otherZones) {
      for (const poly of z.polygons) {
        if (poly.points.length < 3) continue;
        const latLngs = poly.points.map(([lat, lng]) => L.latLng(lat, lng));
        latLngs.forEach((ll) => bounds.push(ll));
        L.polygon(latLngs, {
          color: "#94a3b8",
          weight: 1,
          fillColor: "#cbd5e1",
          fillOpacity: 0.18,
          dashArray: "4 4",
        })
          .bindPopup(`<strong>${z.name}</strong>`)
          .addTo(group);
      }
    }

    for (const poly of polygons) {
      if (poly.points.length < 3) continue;
      const latLngs = poly.points.map(([lat, lng]) => L.latLng(lat, lng));
      latLngs.forEach((ll) => bounds.push(ll));
      L.polygon(latLngs, {
        color: "#015cb4",
        weight: 3,
        fillColor: "#015cb4",
        fillOpacity: 0.22,
      }).addTo(group);

      for (const [lat, lng] of poly.points) {
        L.circleMarker([lat, lng], {
          radius: 5,
          color: "#015cb4",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(group);
      }
    }

    if (draftPoints.length) {
      const draftLatLngs = draftPoints.map(([lat, lng]) => L.latLng(lat, lng));
      draftLatLngs.forEach((ll) => bounds.push(ll));
      L.polyline(draftLatLngs, {
        color: "#dc2626",
        weight: 2,
        dashArray: "6 4",
      }).addTo(group);
      for (const [lat, lng] of draftPoints) {
        L.circleMarker([lat, lng], {
          radius: 4,
          color: "#dc2626",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(group);
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 18 });
    }
  }, [polygons, otherZones, draftPoints]);

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
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [height]);

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
    <div className="spot-map-wrap zone-boundary-map">
      {hint && <p className="spot-map-hint">{hint}</p>}
      {editable && (
        <div className="zone-map-toolbar">
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
          <button type="button" className="btn-small btn-ghost" onClick={clearPolygon}>
            Borrar delimitación
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="zones-map spot-map"
        style={{ height }}
        role="application"
        aria-label="Mapa de delimitación de zona"
      />
    </div>
  );
}
