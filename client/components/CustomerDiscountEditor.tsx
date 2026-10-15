import { Plus, X } from "lucide-react";

export interface DiscountRow {
  label: string;
  percent: string;
}

export function formatPercent(rate: number): number {
  return Number((rate * 100).toFixed(2));
}

export function CustomerDiscountEditor({
  rows,
  onChange,
}: {
  rows: DiscountRow[];
  onChange: (rows: DiscountRow[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<DiscountRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const totalPercent = rows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={row.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
            placeholder="e.g., Prompt payment"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
          />
          <div className="relative w-24">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={row.percent}
              onChange={(e) => updateRow(index, { percent: e.target.value })}
              placeholder="5"
              className="w-full rounded-lg border border-border py-2 pl-3 pr-7 text-sm focus:border-accent-2 focus:outline-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label="Remove discount"
            className="rounded-lg p-2 text-muted hover:bg-off-white hover:text-red"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, { label: "", percent: "" }])}
        className="flex items-center gap-1 text-xs font-semibold text-accent-2 hover:opacity-80"
      >
        <Plus size={14} /> Add discount
      </button>

      <p className="text-xs text-muted">
        Discounts stack. Total discount: {formatPercent(totalPercent / 100)}%
      </p>
    </div>
  );
}
