/** ID corto de 6 caracteres mostrado en tablas y listados. */
export function formatRef(entity: {
  ref?: string | null;
  id?: string;
}): string {
  if (entity.ref) return entity.ref;
  if (entity.id) return entity.id.slice(0, 6).toUpperCase();
  return "—";
}

export function matchesSearch(
  query: string,
  values: (string | number | null | undefined)[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) =>
    String(v ?? "")
      .toLowerCase()
      .includes(q),
  );
}
