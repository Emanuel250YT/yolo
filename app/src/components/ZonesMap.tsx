import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client";
import type { ParkingZone, Spot } from "../types";
import {
  heatColor,
  heatFillOpacity,
  resolveZoneGeoList,
  SALTA_CENTER,
  zoneOccupancy,
} from "../utils/zoneGeo";

interface ZonesMapProps {
  spots: Spot[];
  zones?: ParkingZone[];
  selectedZone?: string | null;
  onZoneSelect?: (zoneCode: string) => void;
  height?: number;
}

export function ZonesMap({
  spots,
  zones: zonesProp,
  selectedZone,
  onZoneSelect,
  height = 360,
}: ZonesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [zones, setZones] = useState<ParkingZone[]>(zonesProp ?? []);

  const loadZones = useCallback(async () => {
    if (zonesProp) {
      setZones(zonesProp);
      return;
    }
    try {
      const { zones: z } = await api.parkingZones();
      setZones(z);
    } catch {
      setZones([]);
    }
  }, [zonesProp]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const zoneGeoList = resolveZoneGeoList(zones);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(SALTA_CENTER, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "",
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const bounds: L.LatLng[] = [];

    zoneGeoList.forEach((zone) => {
      const ratio = zoneOccupancy(spots, zone.code);
      const { fill } = heatColor(ratio);
      const isSelected = selectedZone === zone.code;
      const latLngs = zone.polygon.map(([lat, lng]) => L.latLng(lat, lng));
      latLngs.forEach((ll) => bounds.push(ll));

      const polygon = L.polygon(latLngs, {
        color: isSelected ? "#015cb4" : fill,
        weight: isSelected ? 3 : 2,
        fillColor: fill,
        fillOpacity: heatFillOpacity(ratio),
      });

      polygon.bindPopup(
        `<strong>${zone.name}</strong><br/>Ocupación: ${Math.round(ratio * 100)}%`,
      );

      polygon.on("click", () => onZoneSelect?.(zone.code));
      polygon.addTo(group);

      L.marker(zone.center, {
        icon: L.divIcon({
          className: "zone-map-label",
          html: `<span>${zone.name}</span>`,
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        }),
      }).addTo(group);
    });

    if (bounds.length > 1 && !selectedZone) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 15 });
    }
  }, [spots, selectedZone, onZoneSelect, zoneGeoList]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [height]);

  return (
    <div className="zones-map-wrap">
      <div
        ref={containerRef}
        className="zones-map"
        style={{ height }}
        role="application"
        aria-label="Mapa de zonas de estacionamiento"
      />
      <div className="zones-map-legend">
        <span className="legend-title">Ocupación por zona</span>
        {[
          { c: "#22c55e", l: "Baja" },
          { c: "#84cc16", l: "Moderada" },
          { c: "#f97316", l: "Alta" },
          { c: "#ef4444", l: "Muy alta" },
        ].map((item) => (
          <span key={item.l} className="legend-item">
            <i style={{ background: item.c }} />
            {item.l}
          </span>
        ))}
      </div>
    </div>
  );
}
