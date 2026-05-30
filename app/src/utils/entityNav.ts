export type EntityKind =
  | "user"
  | "zone"
  | "block"
  | "spot"
  | "permit"
  | "reservation"
  | "session";

export interface EntityNavTarget {
  kind: EntityKind;
  ref: string;
  id?: string;
}

type NavHandler = (target: EntityNavTarget) => void;

let handler: NavHandler | null = null;

export function setEntityNavHandler(h: NavHandler | null) {
  handler = h;
}

export function navigateToEntity(
  kind: EntityKind,
  ref: string,
  id?: string,
) {
  if (!ref) return;
  handler?.({ kind, ref, id });
}

export const ENTITY_TAB: Record<EntityKind, string> = {
  user: "usuarios",
  zone: "zonas",
  block: "plazas",
  spot: "plazas",
  permit: "permisos",
  reservation: "reservas",
  session: "permisos",
};
