import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import {
  DEFAULT_DEV_GEO,
  isClientDevToolsEnabled,
  loadDevGeo,
  loadDevShift,
  loadDevClock,
  persistDevShift,
  persistDevClock,
  saveDevGeo,
  type AppMeta,
  type DevClockOverride,
  type DevGeoOverride,
  type DevShiftOverride,
} from "./devConfig";

interface DevToolsContextValue {
  enabled: boolean;
  clientEnabled: boolean;
  serverEnabled: boolean;
  ready: boolean;
  appMeta: AppMeta;
  shiftOverride: DevShiftOverride;
  setShiftOverride: (value: DevShiftOverride) => void;
  clockOverride: DevClockOverride;
  setClockOverride: (value: DevClockOverride) => void;
  geoOverride: DevGeoOverride;
  setGeoOverride: (value: DevGeoOverride) => void;
  refreshKey: number;
  bumpRefresh: () => void;
}

const DEFAULT_META: AppMeta = { version: "0.3.0", commit: "dev" };

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: ReactNode }) {
  const clientEnabled = isClientDevToolsEnabled();
  const [serverEnabled, setServerEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [appMeta, setAppMeta] = useState<AppMeta>(DEFAULT_META);
  const [shiftOverride, setShiftState] = useState<DevShiftOverride>(() =>
    loadDevShift(),
  );
  const [clockOverride, setClockState] = useState<DevClockOverride>(() =>
    loadDevClock(),
  );
  const [geoOverride, setGeoState] = useState<DevGeoOverride>(() =>
    loadDevGeo(),
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .authConfig()
      .then((cfg) => {
        if (cancelled) return;
        setServerEnabled(Boolean(cfg.devTools));
        setAppMeta({
          version: cfg.version ?? DEFAULT_META.version,
          commit: cfg.commit ?? DEFAULT_META.commit,
        });
      })
      .catch(() => {
        if (!cancelled) setServerEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = clientEnabled && serverEnabled;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const payload = {
      enabled: clockOverride.enabled,
      iso: clockOverride.enabled ? clockOverride.iso : null,
    };
    api
      .syncDevClock(payload)
      .catch(() => {
        /* servidor sin DevTools o sin red */
      })
      .then(() => {
        if (!cancelled && clockOverride.enabled) {
          setRefreshKey((k) => k + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, clockOverride.enabled, clockOverride.iso]);

  useEffect(() => {
    if (!enabled || !clockOverride.enabled) return;
    const id = window.setInterval(() => {
      void api.syncDevClock({
        enabled: true,
        iso: clockOverride.iso,
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [enabled, clockOverride.enabled, clockOverride.iso]);

  const setShiftOverride = useCallback((value: DevShiftOverride) => {
    persistDevShift(value);
    setShiftState(value);
    setRefreshKey((k) => k + 1);
  }, []);

  const setClockOverride = useCallback((value: DevClockOverride) => {
    persistDevClock(value);
    setClockState(value);
    setRefreshKey((k) => k + 1);
  }, []);

  const setGeoOverride = useCallback((value: DevGeoOverride) => {
    saveDevGeo(value);
    setGeoState(value);
    setRefreshKey((k) => k + 1);
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      clientEnabled,
      serverEnabled,
      ready,
      appMeta,
      shiftOverride,
      setShiftOverride,
      clockOverride,
      setClockOverride,
      geoOverride,
      setGeoOverride,
      refreshKey,
      bumpRefresh,
    }),
    [
      enabled,
      clientEnabled,
      serverEnabled,
      ready,
      appMeta,
      shiftOverride,
      setShiftOverride,
      clockOverride,
      setClockOverride,
      geoOverride,
      setGeoOverride,
      refreshKey,
      bumpRefresh,
    ],
  );

  return (
    <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>
  );
}

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) {
    return {
      enabled: false,
      clientEnabled: false,
      serverEnabled: false,
      ready: false,
      appMeta: DEFAULT_META,
      shiftOverride: "auto" as DevShiftOverride,
      setShiftOverride: () => {},
      clockOverride: { enabled: false, iso: "" },
      setClockOverride: () => {},
      geoOverride: DEFAULT_DEV_GEO,
      setGeoOverride: () => {},
      refreshKey: 0,
      bumpRefresh: () => {},
    };
  }
  return ctx;
}
