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
    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-opacity-50 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
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
          className="px-3 py-2 rounded-lg border border-border bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:ring-opacity-50 transition-all appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
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
