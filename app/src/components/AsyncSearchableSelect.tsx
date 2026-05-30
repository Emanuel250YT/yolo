import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PaginatedMeta } from "../types";

export interface AsyncSelectOption {
  value: string;
  label: string;
  keywords?: string;
}

interface AsyncSearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  loadPage: (params: {
    page: number;
    q: string;
  }) => Promise<{ options: AsyncSelectOption[] } & PaginatedMeta>;
  required?: boolean;
  id?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  "aria-label"?: string;
}

export function AsyncSearchableSelect({
  value,
  onChange,
  loadPage,
  required,
  id,
  disabled,
  searchPlaceholder = "Buscar…",
  emptyLabel = "Sin opciones",
  "aria-label": ariaLabel,
}: AsyncSearchableSelectProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [options, setOptions] = useState<AsyncSelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (nextPage: number, q: string, append: boolean) => {
      setLoading(true);
      try {
        const res = await loadPage({ page: nextPage, q });
        setOptions((prev) =>
          append ? [...prev, ...res.options] : res.options,
        );
        setHasMore(res.hasMore);
        setPage(nextPage);
      } finally {
        setLoading(false);
      }
    },
    [loadPage],
  );

  useEffect(() => {
    if (!open) return;
    void fetchPage(1, debouncedQ, false);
  }, [open, debouncedQ, fetchPage]);

  useEffect(() => {
    if (!open || !hasMore || loading) return;
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchPage(page + 1, debouncedQ, true);
        }
      },
      { root, threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, hasMore, loading, page, debouncedQ, fetchPage]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? value : emptyLabel);

  return (
    <div
      className={`async-select${disabled ? " disabled" : ""}${open ? " open" : ""}`}
    >
      <button
        type="button"
        id={id}
        className="async-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {displayLabel}
        <span className="async-select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="async-select-panel">
          <input
            type="search"
            className="async-select-query"
            placeholder={searchPlaceholder}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            ref={listRef}
            id={listId}
            className="async-select-list"
            role="listbox"
          >
            {options.length === 0 && !loading && (
              <p className="async-select-empty">{emptyLabel}</p>
            )}
            {options.map((opt) => (
              <OptionRow
                key={opt.value}
                selected={opt.value === value}
                onPick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {opt.label}
              </OptionRow>
            ))}
            <div ref={sentinelRef} className="async-select-sentinel" />
            {loading && <p className="async-select-loading">Cargando…</p>}
          </div>
        </div>
      )}
      {required && (
        <input
          type="text"
          className="async-select-hidden-required"
          tabIndex={-1}
          value={value}
          required
          readOnly
          aria-hidden
        />
      )}
    </div>
  );
}

function OptionRow({
  children,
  selected,
  onPick,
}: {
  children: ReactNode;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`async-select-option${selected ? " selected" : ""}`}
      onClick={onPick}
    >
      {children}
    </button>
  );
}

interface AsyncMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  loadPage: (params: {
    page: number;
    q: string;
  }) => Promise<{ options: AsyncSelectOption[] } & PaginatedMeta>;
  id?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

export function AsyncMultiSelect({
  values,
  onChange,
  loadPage,
  id,
  disabled,
  searchPlaceholder = "Buscar zonas…",
  emptyLabel = "Ninguna zona seleccionada",
}: AsyncMultiSelectProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [options, setOptions] = useState<AsyncSelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (nextPage: number, q: string, append: boolean) => {
      setLoading(true);
      try {
        const res = await loadPage({ page: nextPage, q });
        setOptions((prev) =>
          append ? [...prev, ...res.options] : res.options,
        );
        setHasMore(res.hasMore);
        setPage(nextPage);
      } finally {
        setLoading(false);
      }
    },
    [loadPage],
  );

  useEffect(() => {
    if (!open) return;
    void fetchPage(1, debouncedQ, false);
  }, [open, debouncedQ, fetchPage]);

  useEffect(() => {
    if (!open || !hasMore || loading) return;
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchPage(page + 1, debouncedQ, true);
        }
      },
      { root, threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, hasMore, loading, page, debouncedQ, fetchPage]);

  const selectedLabels = values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);

  function toggle(val: string) {
    onChange(
      values.includes(val)
        ? values.filter((v) => v !== val)
        : [...values, val],
    );
  }

  return (
    <div
      className={`async-select async-multi-select${disabled ? " disabled" : ""}${open ? " open" : ""}`}
    >
      <button
        type="button"
        id={id}
        className="async-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {selectedLabels.length
          ? selectedLabels.join(", ")
          : emptyLabel}
      </button>
      {open && (
        <div className="async-select-panel">
          <input
            type="search"
            className="async-select-query"
            placeholder={searchPlaceholder}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <div ref={listRef} id={listId} className="async-select-list">
            {options.map((opt) => (
              <label key={opt.value} className="async-multi-option">
                <input
                  type="checkbox"
                  checked={values.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
            <div ref={sentinelRef} className="async-select-sentinel" />
            {loading && <p className="async-select-loading">Cargando…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
