import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PaymentBrickLoader } from "../components/MercadoPagoPaymentBrick";
import { PaymentOrderDisplay } from "../components/PaymentOrderDisplay";
import type { PaymentOrderPublic } from "../types";

export function PaymentBrickPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order-id") ?? "";
  const returnStatus = params.get("status");

  const [order, setOrder] = useState<PaymentOrderPublic | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError("Falta el parámetro order-id.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getPaymentOrder(orderId)
      .then((res) => {
        if (cancelled) return;
        setOrder(res.order);
        setPublicKey(res.publicKey);
        if (res.order.status === "paid") setPaid(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la orden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handlePaid = useCallback(() => {
    setPaid(true);
    setOrder((prev) => (prev ? { ...prev, status: "paid" } : prev));
  }, []);

  if (loading) {
    return (
      <div className="payment-brick-page">
        <p>Cargando pago…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="payment-brick-page">
        <h1>Pago SEM</h1>
        <p className="payment-brick-error">{error ?? "Orden no encontrada."}</p>
      </div>
    );
  }

  if (paid || order.status === "paid") {
    return (
      <div className="payment-brick-page">
        <h1>Pago confirmado</h1>
        <p>
          El pago de <strong>{order.title}</strong> fue registrado correctamente.
        </p>
        <p className="payment-brick-amount">
          ${order.amount.toLocaleString("es-AR")} ARS
        </p>
      </div>
    );
  }

  if (order.status !== "pending") {
    return (
      <div className="payment-brick-page">
        <h1>Pago no disponible</h1>
        <p>
          Esta orden está {order.status === "expired" ? "vencida" : order.status}.
        </p>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="payment-brick-page">
        <h1>Configuración incompleta</h1>
        <p>MP_PUBLIC_KEY no está configurada en el servidor.</p>
      </div>
    );
  }

  return (
    <div className="payment-brick-page">
      <PaymentOrderDisplay
        orderId={order.orderId}
        amount={order.amount}
        currencyId={order.currencyId}
        paymentUrl={order.paymentUrl}
        title=""
        subtitle={order.title}
        showQr={false}
        showLink={false}
      />
      {order.description && (
        <p className="payment-brick-desc">{order.description}</p>
      )}
      {returnStatus === "failure" && (
        <p className="payment-brick-error">
          El pago anterior no se completó. Intentá de nuevo.
        </p>
      )}

      <div className="payment-brick-form">
        <h3 className="payment-brick-form-title">Completar pago</h3>
        <PaymentBrickLoader
          key={order.orderId}
          publicKey={publicKey}
          orderId={order.orderId}
          amount={order.amount}
          preferenceId={order.preferenceId}
          onPaid={handlePaid}
        />
      </div>
    </div>
  );
}
