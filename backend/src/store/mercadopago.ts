import { prisma } from "../lib/prisma.js";
import type { MercadoPagoTokens } from "../services/mercadopagoOAuth.js";

export async function linkMercadoPagoAccount(
  userId: string,
  tokens: MercadoPagoTokens,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  if (user.role !== "permisionario") {
    throw new Error("Solo permisionarios pueden vincular Mercado Pago.");
  }

  const tokenExpiresAt =
    tokens.expiresIn != null
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      mercadoPagoUserId: tokens.mercadoPagoUserId,
      mercadoPagoAccessToken: tokens.accessToken,
      mercadoPagoRefreshToken: tokens.refreshToken,
      mercadoPagoLinkedAt: new Date(),
      mercadoPagoTokenExpiresAt: tokenExpiresAt,
    },
  });
}

export function isMercadoPagoLinked(user: {
  mercadoPagoUserId: string | null;
  mercadoPagoAccessToken: string | null;
}) {
  return Boolean(user.mercadoPagoUserId || user.mercadoPagoAccessToken);
}
