import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Session, ShiftStatus, TariffsResponse } from "../types";

export function useSemData() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tariffs, setTariffs] = useState<TariffsResponse | null>(null);
  const [shift, setShift] = useState<ShiftStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await api.health();
      setConnected(true);
      const [t, s, list] = await Promise.all([
        api.tariffs(),
        api.shiftStatus(),
        api.listSessions(),
      ]);
      setTariffs(t);
      setShift(s);
      setSessions(list.sessions);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    connected,
    tariffs,
    shift,
    sessions,
    loading,
    refresh,
  };
}
