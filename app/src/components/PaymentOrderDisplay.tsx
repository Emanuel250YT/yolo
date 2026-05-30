import { useState } from "react";

interface PaymentOrderDisplayProps {
  orderId: string;
  amount: number;
  currencyId?: string;
  paymentUrl: string;
  title?: string;
  subtitle?: string;
  qrSize?: number;
  showQr?: boolean;
  showLink?: boolean;
}

export function PaymentOrderDisplay({
  orderId,
  amount,
  currencyId = "ARS",
  paymentUrl,
  title = "Pago Mercado Pago",
  subtitle,
  qrSize = 320,
  showQr = true,
  showLink = true,
}: PaymentOrderDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="payment-order-display">
      {title && <h2 className="payment-order-title">{title}</h2>}
      {subtitle && <p className="payment-order-subtitle">{subtitle}</p>}

      <p className="payment-order-amount">
        ${amount.toLocaleString("es-AR")}
        <span className="payment-order-currency">{currencyId}</span>
      </p>

      <div className="payment-order-code-block">
        <span className="payment-order-code-label">Código de pago</span>
        <div className="payment-order-code-row">
          <strong className="payment-order-code" aria-label="Código de orden">
            {orderId}
          </strong>
          <button type="button" className="btn-secondary btn-small" onClick={() => void copyCode()}>
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="payment-order-code-hint">
          El conductor puede ingresar este código en la app para pagar manualmente.
        </p>
      </div>

      {showQr && (
        <>
          <img
            className="payment-order-qr"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(paymentUrl)}`}
            alt={`QR de pago orden ${orderId}`}
            width={qrSize}
            height={qrSize}
          />
          <p className="payment-order-scan">Escaneá el QR o usá el código de arriba</p>
        </>
      )}

      {showLink && (
        <a className="payment-order-link" href={paymentUrl} target="_blank" rel="noreferrer">
          Abrir enlace de pago
        </a>
      )}
    </div>
  );
}

interface ConductorPayByCodeFormProps {
  onSubmit: (orderId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function ConductorPayByCodeForm({
  onSubmit,
  loading,
  error,
}: ConductorPayByCodeFormProps) {
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form className="payment-code-form" onSubmit={handleSubmit}>
      <label className="payment-code-field">
        <span>Código de orden</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={6}
          placeholder="Ej: A3K9Z2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="payment-code-input"
        />
      </label>
      <p className="payment-code-help">
        Pedile el código al permisionario si recibiste un permiso por Mercado Pago.
      </p>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary btn-mp" disabled={loading || !code.trim()}>
        {loading ? "Verificando…" : "Continuar al pago"}
      </button>
    </form>
  );
}
