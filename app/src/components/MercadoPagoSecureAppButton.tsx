interface MercadoPagoSecureAppButtonProps {
  initPoint?: string | null;
  preferenceId?: string;
  amount: number;
  currencyId?: string;
}

/** Abre el checkout oficial de Mercado Pago (app o web) sin usar el Payment Brick embebido. */
export function MercadoPagoSecureAppButton({
  initPoint,
  preferenceId,
  amount,
  currencyId = "ARS",
}: MercadoPagoSecureAppButtonProps) {
  const checkoutUrl =
    initPoint ??
    (preferenceId
      ? `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${encodeURIComponent(preferenceId)}`
      : null);

  if (!checkoutUrl) return null;

  return (
    <div className="mp-secure-pay">
      <a
        className="btn-mp-secure"
        href={checkoutUrl}
        rel="noopener noreferrer"
      >
        Pagar de forma segura en Mercado Pago
      </a>
      <p className="mp-secure-pay-hint">
        Abrí tu cuenta de Mercado Pago para completar el pago de{" "}
        <strong>
          ${amount.toLocaleString("es-AR")} {currencyId}
        </strong>
        . En el celular podés usar la app instalada.
      </p>
    </div>
  );
}
