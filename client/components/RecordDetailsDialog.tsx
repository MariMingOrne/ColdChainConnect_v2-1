import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface RecordDetailField {
  label: string;
  value: ReactNode;
}

export interface RecordDetails {
  title: string;
  subtitle?: string;
  fields: RecordDetailField[];
}

interface RecordDetailsDialogProps {
  details: RecordDetails | null;
  onClose: () => void;
}

export function RecordDetailsDialog({ details, onClose }: RecordDetailsDialogProps) {
  return (
    <Dialog open={details !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {details && (
          <>
            <DialogHeader>
              <DialogTitle className="text-navy">{details.title}</DialogTitle>
              {details.subtitle && <DialogDescription>{details.subtitle}</DialogDescription>}
            </DialogHeader>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {details.fields.map((field) => (
                <div key={field.label} className="rounded-lg border border-border bg-off-white/50 px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{field.label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-navy">{field.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
