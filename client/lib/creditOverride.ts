import { CreditBlockResponse } from "@shared/api";

export function isCreditBlock(data: unknown): data is CreditBlockResponse {
  return typeof data === "object" && data !== null && (data as { code?: unknown }).code === "AR_CREDIT_BLOCKED";
}

export function describeCreditBlock(block: CreditBlockResponse): string {
  const lines = block.violations.map((violation) => `• ${violation.message}`);
  const closing = block.canOverride
    ? "An admin can override this block with a reason."
    : "Ask an admin to override this block.";
  return ["This booking is blocked by credit rules:", ...lines, "", closing].join("\n");
}

export function promptCreditOverride(block: CreditBlockResponse): string | null {
  if (!block.canOverride) return null;
  const reason = window.prompt(`${describeCreditBlock(block)}\n\nEnter a reason to override and submit:`);
  return reason?.trim() ? reason.trim() : null;
}
