import { Router } from "express";
import { getMercadoPagoConfig } from "../config/mercadopago.js";
import { processMercadoPagoPayment } from "../services/mercadopagoCheckout.js";
import {
  expireStalePaymentOrders,
  getPaymentOrderByRef,
  markPaymentOrderPaid,
} from "../store/paymentOrders.js";

const router = Router();

router.get("/orders/:orderId", async (req, res) => {
  await expireStalePaymentOrders();
  const order = await getPaymentOrderByRef(String(req.params.orderId));
  if (!order) {
    return res.status(404).json({ error: "Orden de pago no encontrada." });
  }

  const { publicKey } = getMercadoPagoConfig();

  res.json({
    order: {
      orderId: order.orderId,
      amount: order.amount,
      currencyId: order.currencyId,
      preferenceId: order.preferenceId,
      status: order.status,
      title: order.title,
      description: order.description,
      paymentUrl: order.paymentUrl,
      paidAt: order.paidAt,
    },
    publicKey,
  });
});

router.post("/process", async (req, res) => {
  try {
    await expireStalePaymentOrders();
    const orderId =
      typeof req.body?.orderId === "string" ? req.body.orderId : "";
    const formData =
      req.body?.formData && typeof req.body.formData === "object"
        ? (req.body.formData as Record<string, unknown>)
        : null;

    if (!orderId || !formData) {
      return res.status(400).json({ error: "orderId y formData son obligatorios." });
    }

    const order = await getPaymentOrderByRef(orderId);
    if (!order) {
      return res.status(404).json({ error: "Orden de pago no encontrada." });
    }
    if (order.status === "paid") {
      return res.json({ status: "approved", order, message: "Ya estaba pagada." });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ error: "La orden ya no está pendiente de pago." });
    }

    const payment = await processMercadoPagoPayment(
      order.permisionarioId,
      order.orderId,
      formData,
    );

    if (payment.status === "approved" || payment.status === "authorized") {
      const updated = await markPaymentOrderPaid(
        order.orderId,
        payment.paymentId,
        payment.status,
      );
      return res.json({ status: payment.status, paymentId: payment.paymentId, order: updated });
    }

    res.json({
      status: payment.status,
      statusDetail: payment.statusDetail,
      paymentId: payment.paymentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al procesar pago";
    res.status(400).json({ error: message });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const topic = req.query.topic ?? req.body?.topic;
    const id = req.query.id ?? req.body?.data?.id ?? req.body?.id;

    if (topic === "payment" && id) {
      const { getValidMercadoPagoAccessToken } = await import("../store/mercadopago.js");
      const { paymentsUrl } = getMercadoPagoConfig();

      const orders = await import("../store/paymentOrders.js");
      const pending = await import("../lib/prisma.js").then((m) =>
        m.prisma.paymentOrder.findMany({
          where: { status: "pending" },
          take: 50,
          orderBy: { createdAt: "desc" },
        }),
      );

      for (const order of pending) {
        try {
          const token = await getValidMercadoPagoAccessToken(order.permisionarioId);
          const payRes = await fetch(`${paymentsUrl}/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!payRes.ok) continue;
          const pay = (await payRes.json()) as {
            status?: string;
            external_reference?: string;
            id?: number;
          };
          if (pay.external_reference === order.ref && pay.status) {
            if (pay.status === "approved" || pay.status === "authorized") {
              await orders.markPaymentOrderPaid(
                order.ref,
                pay.id != null ? String(pay.id) : null,
                pay.status,
              );
            }
            break;
          }
        } catch {
          /* siguiente orden */
        }
      }
    }

    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

export default router;
