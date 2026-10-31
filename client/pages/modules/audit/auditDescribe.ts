import { AuditLog } from "@shared/api";

type StateRecord = Record<string, unknown>;

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

const ACTION_VERBS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  rollback: "rolled back",
  approve: "approved",
  reject: "rejected",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  rollback: "Rolled back",
  approve: "Approved",
  reject: "Rejected",
};

const ACTION_BADGES: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  rollback: "bg-orange-100 text-orange-800",
  approve: "bg-green-100 text-green-800",
  reject: "bg-red-100 text-red-800",
};

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function getActionBadgeClass(action: string) {
  return ACTION_BADGES[action] ?? "bg-gray-100 text-gray-700";
}

const NAME_FIELDS = ["store_name", "name", "username", "full_name", "receipt_number"];
const HIDDEN_FIELDS = new Set(["password_hash", "password", "updated_at"]);

export function parseState(value: unknown): StateRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as StateRecord) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? (value as StateRecord) : {};
}

function getRecordName(state: StateRecord): string | null {
  for (const key of NAME_FIELDS) {
    const value = state[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function describeLog(log: AuditLog): string {
  const before = parseState(log.before_state);
  const after = parseState(log.after_state);
  const name = getRecordName(after) ?? getRecordName(before);
  const verb = ACTION_VERBS[log.action] ?? log.action;
  const resource = log.resource_type.replace(/_/g, " ");
  const subject = name
    ? `"${name}"`
    : log.resource_id
      ? `#${log.resource_id.slice(0, 6).toUpperCase()}`
      : "";
  const sentence = `${verb} ${resource}${subject ? ` ${subject}` : ""}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function getFieldChanges(log: AuditLog): FieldChange[] {
  const before = parseState(log.before_state);
  const after = parseState(log.after_state);
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);

  return [...fields]
    .filter((field) => !HIDDEN_FIELDS.has(field))
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

export function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
