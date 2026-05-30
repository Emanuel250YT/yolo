import { prisma } from "../lib/prisma.js";
import { refreshMercadoPagoToken } from "../services/mercadopagoOAuth.js";

const REFRESH_BUFFER_MS = 30 * 60 * 1000;

export function isMercadoPagoLinked(user: {
  mercadoPagoUserId: string | null;
  mercadoPagoAccessToken: string | null;
}) {
  return Boolean(user.mercadoPagoUserId || user.mercadoPagoAccessToken);
}

async function persistTokens(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    mercadoPagoUserId: string | null;
    expiresIn: number | null;
  },
) {
  const tokenExpiresAt =
    tokens.expiresIn != null
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      mercadoPagoUserId: tokens.mercadoPagoUserId,
      mercadoPagoAccessToken: tokens.accessToken,
      mercadoPagoRefreshToken: tokens.refreshToken ?? undefined,
      mercadoPagoLinkedAt: new Date(),
      mercadoPagoTokenExpiresAt: tokenExpiresAt,
    },
  });
}

export async function linkMercadoPagoAccount(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    mercadoPagoUserId: string | null;
    expiresIn: number | null;
  },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario no encontrado.");
  if (user.role !== "permisionario") {
    throw new Error("Solo permisionarios pueden vincular Mercado Pago.");
  }
  await persistTokens(userId, tokens);
}

export async function refreshUserMercadoPagoToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mercadoPagoRefreshToken) {
    throw new Error("El permisionario no tiene refresh token de Mercado Pago.");
  }

  const tokens = await refreshMercadoPagoToken(user.mercadoPagoRefreshToken);
  await persistTokens(userId, tokens);
  return tokens.accessToken;
}

/** Devuelve un access token válido, refrescándolo si está por vencer. */
export async function getValidMercadoPagoAccessToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mercadoPagoAccessToken) {
    throw new Error("El permisionario no tiene Mercado Pago vinculado.");
  }

  const expiresAt = user.mercadoPagoTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh =
    !expiresAt || expiresAt - Date.now() <= REFRESH_BUFFER_MS;

  if (needsRefresh && user.mercadoPagoRefreshToken) {
    return refreshUserMercadoPagoToken(userId);
  }

  return user.mercadoPagoAccessToken;
}

export async function findMercadoPagoCollectorForZone(zoneCode: string) {
  const zone = await prisma.parkingZone.findUnique({
    where: { code: zoneCode },
    select: { id: true },
  });

  const users = await prisma.user.findMany({
    where: {
      role: "permisionario",
      active: true,
      mercadoPagoAccessToken: { not: null },
      OR: zone
        ? [
            { parkingZoneId: zone.id },
            { zone: zoneCode },
            {
              assignedZones: {
                some: { parkingZoneId: zone.id },
              },
            },
          ]
        : [{ zone: zoneCode }],
    },
    orderBy: { mercadoPagoLinkedAt: "desc" },
    take: 1,
  });

  return users[0] ?? null;
}
