import { DataTable } from "./DataTable";
import {
  SPOT_TYPE_LABEL,
  spotStatusLabel,
  spotStatusOf,
} from "../utils/spotMapStyles";
import type { Spot } from "../types";

interface SelectedSpotTableProps {
  spot: Spot;
}

export function SelectedSpotTable({ spot }: SelectedSpotTableProps) {
  const st = spotStatusOf(spot);
  return (
    <div className="selected-spot-table-wrap">
      <DataTable
        rows={[spot]}
        rowKey={(s) => s.id}
        emptyMessage="Sin plaza seleccionada."
        columns={[
          {
            key: "label",
            header: "Plaza",
            render: (s) => <strong>{s.label}</strong>,
          },
          {
            key: "location",
            header: "Ubicación",
            render: (s) => s.blockStreet || s.address || "—",
          },
          {
            key: "type",
            header: "Tipo",
            render: (s) => (
              <span
                className={`chip${s.spotType === "gratuita" ? " chip--free" : ""}`}
              >
                {SPOT_TYPE_LABEL[s.spotType ?? "pago"] ?? s.spotType}
              </span>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (s) => (
              <span className={`chip status-chip status-${spotStatusOf(s)}`}>
                {spotStatusLabel(s)}
              </span>
            ),
          },
        ]}
      />
      {spot.spotType === "gratuita" && (
        <p className="info-inline spot-free-notice">
          Plaza gratuita — el permiso se registra sin cargo ($0).
        </p>
      )}
      {st !== "available" && (
        <p className="form-error">Esta plaza ya no está libre.</p>
      )}
    </div>
  );
}
