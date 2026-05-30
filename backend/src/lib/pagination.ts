export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function parsePaginationQuery(
  query: Record<string, unknown>,
  defaultPageSize = 20,
): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, Number(query.pageSize) || defaultPageSize),
  );
  const q = typeof query.q === "string" ? query.q.trim() : undefined;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q: q || undefined,
  };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages,
    hasMore: params.page < totalPages,
  };
}

export function paginationMeta(result: PaginatedResult<unknown>) {
  return {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    hasMore: result.hasMore,
  };
}

/** Normaliza respuesta de store que puede ser lista completa o paginada. */
export function asList<T>(result: PaginatedResult<T> | T[]): T[] {
  return Array.isArray(result) ? result : result.items;
}

export function listCount<T>(result: PaginatedResult<T> | T[]): number {
  return Array.isArray(result) ? result.length : result.total;
}
