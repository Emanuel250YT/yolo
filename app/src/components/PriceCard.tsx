import type { PricingBreakdown } from "../types";

interface PriceCardProps {
  title: string;
  plate?: string;
  minutes?: number;
  pricing: PricingBreakdown & { minutes?: number };
}

export function PriceCard({ title, plate, minutes, pricing }: PriceCardProps) {
  const mins = minutes ?? ("minutes" in pricing ? pricing.minutes : undefined);

  return (
    <div className="price-card">
      <h3>{title}</h3>
      {plate && <p className="plate-tag">{plate}</p>}
      {mins != null && (
        <p className="meta">{mins} min de estadía</p>
      )}
      <dl className="price-lines">
        <div>
          <dt>Importe bruto</dt>
          <dd>${pricing.gross.toLocaleString("es-AR")}</dd>
        </div>
        {pricing.digitalDiscount > 0 && (
          <div className="discount">
            <dt>Descuento digital</dt>
            <dd>−${pricing.digitalDiscount.toLocaleString("es-AR")}</dd>
          </div>
        )}
        <div className="total-line">
          <dt>Total a pagar</dt>
          <dd>${pricing.net.toLocaleString("es-AR")}</dd>
        </div>
      </dl>
      {pricing.digitalPayment && (
        <p className="badge-digital">Pago digital aplicado</p>
      )}
    </div>
  );
}
