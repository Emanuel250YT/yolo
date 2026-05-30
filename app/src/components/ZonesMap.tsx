import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, fetchLiveSpotsForRole } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useDevTools } from "../dev/DevToolsContext";
import type { ParkingZone, Spot } from "../types";
import { filterZonesForUser } from "../utils/zoneDefaults";
import {
  heatColor,
  heatFillOpacity,
  resolveZoneGeoList,
  SALTA_CENTER,
  spotsInZone,
  zoneOccupancy,
} from "../utils/zoneGeo";

interface ZonesMapProps {
  spots?: Spot[];
  zones?: ParkingZone[];
  selectedZone?: string | null;
  onZoneSelect?: (zoneCode: string) => void;
  height?: number;
  /** Actualiza ocupación cada 5 s (por defecto activo). */
  liveRefresh?: boolean;
  zoneFilter?: string | null;
}

export function ZonesMap({
  spots: spotsProp,
  zones: zonesProp,
  selectedZone,
  onZoneSelect,
  height = 360,
  liveRefresh = true,
  zoneFilter,
}: ZonesMapProps) {
  const { user } = useAuth();
  const { refreshKey } = useDevTools();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [zones, setZones] = useState<ParkingZone[]>(zonesProp ?? []);
  const [liveSpots, setLiveSpots] = useState<Spot[]>(spotsProp ?? []);

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

  const fetchLiveSpots = useCallback(async () => {
    if (!liveRefresh || !user?.role) return;
    try {
      const opts =
        zoneFilter != null && zoneFilter !== ""
          ? { zone: zoneFilter }
          : undefined;
      const spots = await fetchLiveSpotsForRole(user.role, opts);
      setLiveSpots(spots);
    } catch {
      /* ignore polling errors */
    }
  }, [liveRefresh, user?.role, zoneFilter, refreshKey]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  useEffect(() => {
    if (!liveRefresh && spotsProp) {
      setLiveSpots(spotsProp);
    }
  }, [liveRefresh, spotsProp]);

  useEffect(() => {
    if (!liveRefresh || !user?.role) return;
    void fetchLiveSpots();
    const id = window.setInterval(() => {
      void fetchLiveSpots();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [liveRefresh, fetchLiveSpots, user?.role, refreshKey]);

  const spots = liveRefresh ? liveSpots : (spotsProp ?? liveSpots);

  const visibleZones = useMemo(
    () => filterZonesForUser(zones, user),
    [zones, user],
  );

  const zoneGeoList = resolveZoneGeoList(visibleZones);

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

    zoneGeoList.forEach((zoneGeo) => {
      const zoneMeta = visibleZones.find((z) => z.code === zoneGeo.code);
      const zoneRef = { code: zoneGeo.code, id: zoneMeta?.id };
      const inZone = spotsInZone(spots, zoneRef, zoneGeo.polygon);
      const ratio = zoneOccupancy(spots, zoneRef, zoneGeo.polygon);
      const taken = inZone.filter((s) => {
        if (s.status) return s.status === "occupied" || s.status === "held";
        return s.occupied >= s.capacity;
      }).length;
      const { fill } = heatColor(ratio);
      const isSelected = selectedZone === zoneGeo.code;
      const latLngs = zoneGeo.polygon.map(([lat, lng]) => L.latLng(lat, lng));
      latLngs.forEach((ll) => bounds.push(ll));

      const polygon = L.polygon(latLngs, {
        color: isSelected ? "#015cb4" : fill,
        weight: isSelected ? 3 : 2,
        fillColor: fill,
        fillOpacity: heatFillOpacity(ratio),
      });

      const pct = Math.round(ratio * 100);
      polygon.bindPopup(
        `<strong>${zoneGeo.name}</strong><br/>Ocupación: ${pct}% (${taken}/${inZone.length || "?"})`,
      );

      polygon.on("click", () => onZoneSelect?.(zoneGeo.code));
      polygon.addTo(group);

      L.marker(zoneGeo.center, {
        icon: L.divIcon({
          className: "zone-map-label",
          html: `<span>${zoneGeo.name}</span>`,
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        }),
      }).addTo(group);
    });

    if (bounds.length > 1 && !selectedZone) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 15 });
    }
  }, [spots, selectedZone, onZoneSelect, zoneGeoList, visibleZones]);

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
        {liveRefresh && (
          <span className="legend-live">Actualización cada 5 s</span>
        )}
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
