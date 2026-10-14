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
};

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
      ? `#${log.resource_id.slice(0, 8)}`
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
