import { useState } from "react";
import { Layout } from "./components/Layout";
import { HomePanel } from "./components/HomePanel";
import { ParkPanel } from "./components/ParkPanel";
import { QuotePanel } from "./components/QuotePanel";
import { SessionsList } from "./components/SessionsList";
import { ShiftBanner } from "./components/ShiftBanner";
import { useSemData } from "./hooks/useSemData";
import type { TabId } from "./types";

export default function App() {
  const [tab, setTab] = useState<TabId>("inicio");
  const { connected, tariffs, shift, sessions, loading, refresh } = useSemData();

  if (loading) {
    return (
      <div className="boot">
        <p>Conectando con la API…</p>
      </div>
    );
  }

  if (connected === false) {
    return (
      <div className="boot error-boot">
        <h1>No se pudo conectar al backend</h1>
        <p>
          Ejecutá el servidor en otra terminal:
          <code>cd backend && npm run dev</code>
        </p>
        <p>Luego recargá esta página (puerto 3001).</p>
        <button type="button" className="btn-primary" onClick={() => refresh()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <Layout tab={tab} onTab={setTab} connected={connected}>
      <ShiftBanner shift={shift} tariffs={tariffs?.tariffs ?? null} />

      {tab === "inicio" && (
        <HomePanel tariffs={tariffs} shift={shift} />
      )}
      {tab === "estacionar" && (
        <ParkPanel shift={shift} onSessionChange={refresh} />
      )}
      {tab === "cotizar" && (
        <QuotePanel tariffs={tariffs?.tariffs ?? null} />
      )}
      {tab === "activas" && (
        <SessionsList sessions={sessions} onRefresh={refresh} />
      )}
    </Layout>
  );
}
