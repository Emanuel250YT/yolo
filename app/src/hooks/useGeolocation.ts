import { useEffect, useState } from "react";
import { useDevTools } from "../dev/DevToolsContext";

interface GeoState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation(enabled = true) {
  const { geoOverride, refreshKey } = useDevTools();
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (geoOverride.enabled) {
      setState({
        lat: geoOverride.lat,
        lng: geoOverride.lng,
        error: null,
        loading: false,
      });
      return;
    }

    if (!enabled || !navigator.geolocation) {
      setState((s) => ({
        ...s,
        loading: false,
        error: navigator.geolocation
          ? null
          : "Geolocalización no disponible en este dispositivo.",
      }));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState({
          lat: null,
          lng: null,
          error: err.message,
          loading: false,
        });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, geoOverride.enabled, geoOverride.lat, geoOverride.lng, refreshKey]);

  return state;
}
