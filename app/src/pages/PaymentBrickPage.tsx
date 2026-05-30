import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PaymentBrickLoader } from "../components/MercadoPagoPaymentBrick";
import { MercadoPagoSecureAppButton } from "../components/MercadoPagoSecureAppButton";
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

  const loadOrder = useCallback(async () => {
    const res = await api.getPaymentOrder(orderId);
    setOrder(res.order);
    setPublicKey(res.publicKey);
    if (res.order.status === "paid") setPaid(true);
    return res.order;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setError("Falta el parámetro order-id.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadOrder()
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
  }, [orderId, loadOrder]);

  useEffect(() => {
    if (!orderId || paid) return;
    if (returnStatus !== "success" && returnStatus !== "pending") return;

    let cancelled = false;
    const poll = window.setInterval(() => {
      void loadOrder().then((o) => {
        if (cancelled || o.status !== "paid") return;
        setPaid(true);
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [orderId, returnStatus, paid, loadOrder]);

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
      {(returnStatus === "success" || returnStatus === "pending") && (
        <p className="payment-brick-return">
          Volviste de Mercado Pago. Si el pago fue aprobado, se confirmará en
          unos segundos.
        </p>
      )}

      <section className="payment-brick-section payment-brick-section--primary">
        <h3 className="payment-brick-form-title">Completar pago</h3>
        <p className="payment-brick-section-desc">
          Tarjeta, Rapipago, Pago Fácil y otros medios disponibles.
        </p>
        <PaymentBrickLoader
          key={order.orderId}
          publicKey={publicKey}
          orderId={order.orderId}
          amount={order.amount}
          preferenceId={order.preferenceId}
          onPaid={handlePaid}
        />
      </section>

      <section className="payment-brick-section payment-brick-section--alt">
        <h3 className="payment-brick-form-title">¿Preferís la app?</h3>
        <p className="payment-brick-section-desc">
          Si no querés pagar desde el formulario embebido, abrí el checkout
          seguro de Mercado Pago en la app o en el navegador.
        </p>
        <MercadoPagoSecureAppButton
          initPoint={order.initPoint}
          preferenceId={order.preferenceId}
          amount={order.amount}
          currencyId={order.currencyId}
        />
      </section>
    </div>
  );
}
