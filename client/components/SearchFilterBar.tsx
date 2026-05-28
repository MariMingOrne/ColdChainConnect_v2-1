import { Search, X } from "lucide-react";

interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filters?: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    options: { label: string; value: string }[];
  }[];
}

export function SearchFilterBar({
  searchTerm,
  onSearchChange,
  placeholder = "Search…",
  filters = [],
}: SearchFilterBarProps) {
  return (
    <div className="flex-1 flex flex-col sm:flex-row gap-3 items-stretch">
      <div className="flex-1 flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
        <span className="text-muted">🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="text-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {filters.map((filter) => (
        <select
          key={filter.name}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          className="px-3 py-2 bg-navy-mid border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
            paddingRight: "28px",
          }}
        >
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
