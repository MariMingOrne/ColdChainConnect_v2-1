import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AuditLog } from "@shared/api";
import { describeLog, formatFieldValue, getFieldChanges, parseState } from "./auditDescribe";

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  onClose: () => void;
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 break-all text-sm text-navy ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  );
}

export function AuditLogDetailDialog({ log, onClose }: AuditLogDetailDialogProps) {
  if (!log) return null;

  const changes = getFieldChanges(log);
  const snapshot = log.action === "delete" ? parseState(log.before_state) : parseState(log.after_state);
  const snapshotLabel = log.action === "delete" ? "Deleted record" : "Saved record";

  return (
    <Dialog open={!!log} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{describeLog(log)}</DialogTitle>
          <DialogDescription>
            {new Date(log.created_at).toLocaleString()} · {log.action.toUpperCase()} · {log.resource_type.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-off-white p-4 sm:grid-cols-2">
          <DetailField label="Performed by (user ID)" value={log.user_id} mono />
          <DetailField label="Timestamp" value={new Date(log.created_at).toLocaleString()} />
          <DetailField label="Action" value={log.action} />
          <DetailField label="Resource type" value={log.resource_type.replace(/_/g, " ")} />
          <DetailField label="Resource ID" value={log.resource_id ?? "—"} mono />
          <DetailField label="Log entry ID" value={log.id} mono />
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-navy">Field changes</h3>
          {changes.length === 0 ? (
            <p className="text-sm text-gray-500">No field-level changes were recorded for this entry.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-navy-mid text-left text-xs uppercase tracking-wide text-white">
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-semibold text-navy">{change.field.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-gray-600 break-all">{formatFieldValue(change.before)}</td>
                      <td className="px-3 py-2 text-navy break-all">{formatFieldValue(change.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500">Password hashes and last-updated timestamps are hidden.</p>
        </section>

        {Object.keys(snapshot).length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-navy">{snapshotLabel}</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border p-4 sm:grid-cols-2">
              {Object.entries(snapshot)
                .filter(([field]) => field !== "password_hash" && field !== "password" && field !== "updated_at")
                .map(([field, value]) => (
                  <div key={field} className="flex justify-between gap-3 border-b border-border/60 pb-1 text-sm">
                    <dt className="capitalize text-gray-500">{field.replace(/_/g, " ")}</dt>
                    <dd className="text-right text-navy break-all">{formatFieldValue(value)}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
