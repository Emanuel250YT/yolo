import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

const BRICK_CUSTOMIZATION = {
  paymentMethods: {
    ticket: "all" as const,
    creditCard: "all" as const,
    prepaidCard: "all" as const,
    debitCard: "all" as const,
  },
};

let mpInitKey: string | null = null;

function ensureMercadoPagoInit(publicKey: string) {
  if (mpInitKey === publicKey) return;
  initMercadoPago(publicKey, { locale: "es-AR" });
  mpInitKey = publicKey;
}

interface MercadoPagoPaymentBrickProps {
  orderId: string;
  amount: number;
  preferenceId: string;
  onPaid: () => void;
}

/** Monta un único Payment Brick con callbacks estables. */
export function MercadoPagoPaymentBrick({
  orderId,
  amount,
  preferenceId,
  onPaid,
}: MercadoPagoPaymentBrickProps) {
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const initialization = useMemo(
    () => ({ amount, preferenceId }),
    [amount, preferenceId],
  );

  const onSubmit = useCallback(
    async (param: { formData: object }) => {
      const res = await api.processPayment(
        orderId,
        param.formData as Record<string, unknown>,
      );
      if (res.status === "approved" || res.status === "authorized") {
        onPaidRef.current();
      }
    },
    [orderId],
  );

  const onReady = useCallback(() => {}, []);
  const onError = useCallback((err: unknown) => {
    console.error("[MP Brick]", err);
  }, []);

  useEffect(() => {
    return () => {
      const c = (
        window as Window & { paymentBrickController?: { unmount?: () => void } }
      ).paymentBrickController;
      c?.unmount?.();
    };
  }, []);

  return (
    <Payment
      id="sem-payment-brick"
      initialization={initialization}
      customization={BRICK_CUSTOMIZATION}
      onSubmit={onSubmit}
      onReady={onReady}
      onError={onError}
    />
  );
}

interface PaymentBrickLoaderProps {
  publicKey: string;
  orderId: string;
  amount: number;
  preferenceId: string;
  onPaid: () => void;
}

/** Evita montar el brick hasta que MP esté inicializado (1 sola instancia). */
export function PaymentBrickLoader(props: PaymentBrickLoaderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureMercadoPagoInit(props.publicKey);
    setReady(true);
    return () => {
      setReady(false);
      const c = (
        window as Window & { paymentBrickController?: { unmount?: () => void } }
      ).paymentBrickController;
      c?.unmount?.();
    };
  }, [props.publicKey]);

  if (!ready) return <p>Inicializando Mercado Pago…</p>;

  return (
    <MercadoPagoPaymentBrick
      orderId={props.orderId}
      amount={props.amount}
      preferenceId={props.preferenceId}
      onPaid={props.onPaid}
    />
  );
}
