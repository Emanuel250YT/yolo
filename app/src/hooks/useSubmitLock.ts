import { useCallback, useRef, useState } from "react";

export function useSubmitLock() {
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setBusy(true);
      try {
        return await fn();
      } finally {
        lockRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, run };
}
