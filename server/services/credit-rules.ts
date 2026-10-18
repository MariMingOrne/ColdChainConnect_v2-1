import { CreditViolation } from "@shared/api";

export interface CustomerCreditState {
  termsDays: number;
  creditLimit: number | null;
  arBalance: number;
  overdueAmount: number;
  oldestOverdueDays: number;
  undeliveredInvoiceTotal: number;
  newOrderAmount: number;
}

export function evaluateCreditRules(state: CustomerCreditState): CreditViolation[] {
  const violations: CreditViolation[] = [];

  if (state.overdueAmount > 0) {
    violations.push({
      code: "OVERDUE_BEYOND_TERMS",
      message: `₱${state.overdueAmount.toFixed(2)} is overdue beyond the ${state.termsDays}-day terms (oldest: ${state.oldestOverdueDays} days).`,
    });
  }

  if (state.creditLimit !== null) {
    const exposure = state.arBalance + state.undeliveredInvoiceTotal + state.newOrderAmount;
    if (exposure > state.creditLimit) {
      violations.push({
        code: "CREDIT_LIMIT_EXCEEDED",
        message: `Exposure with this order would be ₱${exposure.toFixed(2)}, above the ₱${state.creditLimit.toFixed(2)} credit limit.`,
      });
    }
  }

  return violations;
}
