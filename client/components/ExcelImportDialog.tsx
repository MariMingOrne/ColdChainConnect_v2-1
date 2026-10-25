import { useState, type ChangeEvent } from "react";
import { AlertTriangle, FileSpreadsheet, Upload, X } from "lucide-react";
import { ExcelColumn, ExcelRow, readExcelRows } from "@/lib/excel";

interface ExcelImportDialogProps {
  title: string;
  columns: ExcelColumn[];
  validateRow: (values: Record<string, unknown>) => string[];
  onImport: (rows: Record<string, unknown>[]) => Promise<void>;
  onClose: () => void;
}

export function ExcelImportDialog({ title, columns, validateRow, onImport, onClose }: ExcelImportDialogProps) {
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setError("");
    try {
      const parsedRows = await readExcelRows(file, columns);
      if (parsedRows.length === 0) throw new Error("The worksheet has no data rows.");
      if (parsedRows.length > 1000) throw new Error("Import files are limited to 1,000 data rows.");
      setRows(parsedRows);
    } catch (readError) {
      setRows([]);
      setError(readError instanceof Error ? readError.message : "Could not read this workbook.");
    } finally {
      setIsReading(false);
      event.target.value = "";
    }
  };

  const rowErrors = rows.map((row) => ({ row, errors: validateRow(row.values) }));
  const validCount = rowErrors.filter((entry) => entry.errors.length === 0).length;
  const invalidCount = rowErrors.length - validCount;

  const importRows = async () => {
    const validRows = rowErrors.filter((entry) => entry.errors.length === 0).map((entry) => entry.row.values);
    if (invalidCount || validRows.length === 0) return;
    setIsImporting(true);
    setError("");
    try {
      await onImport(validRows);
      setImportedCount(validRows.length);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isImporting && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="excel-import-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-white">
        <header className="flex items-center justify-between border-b border-border bg-navy-mid px-5 py-4 text-white">
          <div>
            <h2 id="excel-import-title" className="font-rajdhani text-lg font-bold">Import {title}</h2>
            <p className="mt-1 text-xs text-white/70">Choose an .xlsx file with the exported column headers.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isImporting} aria-label="Close import" className="text-2xl leading-none hover:opacity-70 disabled:opacity-50"><X size={22} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-off-white px-4 py-3 text-sm font-semibold text-navy hover:border-accent-2">
              <FileSpreadsheet size={20} className="shrink-0 text-accent-2" />
              <span className="flex-1">{isReading ? "Reading workbook…" : "Choose .xlsx workbook"}</span>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={isReading || isImporting || importedCount !== null} onChange={handleFile} className="sr-only" />
            </label>
            <p className="mt-2 text-xs text-muted">Import creates new records only; it does not update or delete existing records. Export the workbook for a template.</p>
          </div>

          {error && <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">{error}</p>}
          {importedCount !== null && <p role="status" className="rounded-lg border border-green/30 bg-green/10 px-3 py-2 text-sm font-semibold text-green">Successfully imported {importedCount} rows.</p>}
          {rows.length > 0 && importedCount === null && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${invalidCount ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
                {invalidCount ? <AlertTriangle size={16} /> : <FileSpreadsheet size={16} />}
                <span>{validCount} valid · {invalidCount} with errors</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-off-white text-muted"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-2">{column.header}{column.required ? " *" : ""}</th>)}<th className="px-3 py-2">Validation</th></tr></thead>
                  <tbody>{rowErrors.slice(0, 30).map(({ row, errors: messages }) => (
                    <tr key={row.rowNumber} className="border-t border-border align-top">
                      {columns.map((column) => <td key={column.key} className="max-w-56 truncate px-3 py-2">{String(row.values[column.key] ?? "")}</td>)}
                      <td className={`min-w-48 px-3 py-2 ${messages.length ? "text-red" : "text-green"}`}>{messages.length ? messages.join("; ") : "Ready"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {rows.length > 30 && <p className="text-xs text-muted">Showing first 30 of {rows.length} rows.</p>}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border bg-off-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={isImporting} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy hover:bg-white disabled:opacity-50">Cancel</button>
          <button type="button" onClick={importedCount !== null ? onClose : () => void importRows()} disabled={isImporting || (importedCount === null && (!rows.length || invalidCount > 0))} className="inline-flex items-center gap-2 rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <Upload size={16} />{importedCount !== null ? "Done" : isImporting ? "Importing…" : `Import ${validCount} rows`}
          </button>
        </footer>
      </section>
    </div>
  );
}
