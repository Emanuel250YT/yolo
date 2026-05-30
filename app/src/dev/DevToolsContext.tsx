import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DEV_GEO,
  isDevToolsEnabled,
  loadDevGeo,
  loadDevShift,
  persistDevShift,
  saveDevGeo,
  type DevGeoOverride,
  type DevShiftOverride,
} from "./devConfig";

interface DevToolsContextValue {
  enabled: boolean;
  shiftOverride: DevShiftOverride;
  setShiftOverride: (value: DevShiftOverride) => void;
  geoOverride: DevGeoOverride;
  setGeoOverride: (value: DevGeoOverride) => void;
  refreshKey: number;
  bumpRefresh: () => void;
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: ReactNode }) {
  const enabled = isDevToolsEnabled();
  const [shiftOverride, setShiftState] = useState<DevShiftOverride>(() =>
    loadDevShift(),
  );
  const [geoOverride, setGeoState] = useState<DevGeoOverride>(() =>
    loadDevGeo(),
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const setShiftOverride = useCallback((value: DevShiftOverride) => {
    persistDevShift(value);
    setShiftState(value);
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
      shiftOverride,
      setShiftOverride,
      geoOverride,
      setGeoOverride,
      refreshKey,
      bumpRefresh,
    }),
    [
      enabled,
      shiftOverride,
      setShiftOverride,
      geoOverride,
      setGeoOverride,
      refreshKey,
      bumpRefresh,
    ],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>
  );
}

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) {
    return {
      enabled: false,
      shiftOverride: "auto" as DevShiftOverride,
      setShiftOverride: () => {},
      geoOverride: DEFAULT_DEV_GEO,
      setGeoOverride: () => {},
      refreshKey: 0,
      bumpRefresh: () => {},
    };
  }
  return ctx;
}
