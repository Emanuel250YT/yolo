import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useDevTools } from "../dev/DevToolsContext";
import type { Session, ShiftStatus, TariffsResponse } from "../types";

export function useSemData() {
  const { refreshKey } = useDevTools();
  const [tariffs, setTariffs] = useState<TariffsResponse | null>(null);
  const [shift, setShift] = useState<ShiftStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [t, s, list] = await Promise.all([
        api.tariffs(),
        api.shiftStatus(),
        api.listSessions(),
      ]);
      setTariffs(t);
      setShift(s);
      setSessions(list.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { tariffs, shift, sessions, loading, error, refresh };
}
