import { useMemo, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
  keywords?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  required?: boolean;
  id?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  "aria-label"?: string;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function SearchableSelect({
  value,
  onChange,
  options,
  required,
  id,
  disabled,
  searchPlaceholder = "Buscar por nombre, código o ID…",
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((opt) => {
      const haystack = normalize(
        `${opt.label} ${opt.keywords ?? ""} ${opt.value}`,
      );
      return haystack.includes(q);
    });
  }, [options, query]);

  const displayOptions =
    filtered.length > 0
      ? filtered
      : value
        ? options.filter((o) => o.value === value)
        : options.slice(0, 1);

  return (
    <div className={`searchable-select${disabled ? " disabled" : ""}`}>
      <input
        type="search"
        className="searchable-select-query"
        placeholder={searchPlaceholder}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        aria-controls={id ? `${id}-list` : undefined}
      />
      <select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        aria-label={ariaLabel ?? searchPlaceholder}
        size={Math.min(Math.max(displayOptions.length, 1), 6)}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery("");
        }}
      >
        {displayOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {query && filtered.length === 0 && (
        <p className="searchable-select-empty">Sin coincidencias</p>
      )}
    </div>
  );
}
