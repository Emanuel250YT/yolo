import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const TABLE_PAGE_SIZE = 20;

export interface PaginatedFetchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ServerPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSearchChange?: (q: string) => void;
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
}

export function usePaginatedTable<T>({
  fetchPage,
  enabled = true,
  resetKey,
  pageSize = TABLE_PAGE_SIZE,
}: {
  fetchPage: (params: {
    page: number;
    pageSize: number;
    q: string;
    filters: Record<string, string>;
  }) => Promise<PaginatedFetchResult<T>>;
  /** When false, skips fetching (e.g. inactive tab). */
  enabled?: boolean;
  /** When this value changes, reload page 1 (e.g. zoneId, refreshKey). */
  resetKey?: unknown;
  pageSize?: number;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (nextPage: number, search: string, f: Record<string, string>) => {
      setLoading(true);
      try {
        const res = await fetchPageRef.current({
          page: nextPage,
          pageSize,
          q: search,
          filters: f,
        });
        setItems(res.items);
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setHasMore(res.hasMore);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    if (!enabled) return;
    void load(1, debouncedQ, filters);
  }, [enabled, debouncedQ, filters, resetKey, load]);

  const onPageChange = useCallback(
    (p: number) => {
      void load(p, debouncedQ, filters);
    },
    [load, debouncedQ, filters],
  );

  const onFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value || value === "all") delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const serverPagination = useMemo(
    (): ServerPaginationProps => ({
      page,
      pageSize,
      total,
      totalPages,
      hasMore,
      loading,
      onPageChange,
      onSearchChange: setQ,
      filterValues: filters,
      onFilterChange,
    }),
    [
      page,
      pageSize,
      total,
      totalPages,
      hasMore,
      loading,
      onPageChange,
      filters,
      onFilterChange,
    ],
  );

  const refresh = useCallback(() => {
    void load(page, debouncedQ, filters);
  }, [load, page, debouncedQ, filters]);

  return { items, serverPagination, refresh, loading };
}
