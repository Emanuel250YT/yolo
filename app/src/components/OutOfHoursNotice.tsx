import { ShiftBanner } from "./ShiftBanner";
import type { ShiftStatus, Tariffs } from "../types";

interface OutOfHoursNoticeProps {
  shift: ShiftStatus | null;
  tariffs?: Tariffs | null;
  title?: string;
}

export function OutOfHoursNotice({
  shift,
  tariffs = null,
  title = "Cobro no disponible en este horario",
}: OutOfHoursNoticeProps) {
  return (
    <div className="out-of-hours-notice">
      <ShiftBanner shift={shift} tariffs={tariffs} />
      <div className="out-of-hours-body">
        <h3>{title}</h3>
        <p>
          {shift?.message ??
            "No se pueden efectuar cobros fuera del horario habilitado para tu zona."}
        </p>
        <p className="meta">
          El formulario de cobro estará disponible cuando el turno esté abierto
          según el calendario SEM.
        </p>
      </div>
    </div>
  );
}
