import { describe, expect, it } from "vitest";
import { CustomerCreditState, evaluateCreditRules } from "./credit-rules";

const clean: CustomerCreditState = {
  termsDays: 30,
  creditLimit: 50000,
  arBalance: 0,
  overdueAmount: 0,
  oldestOverdueDays: 0,
  undeliveredInvoiceTotal: 0,
  newOrderAmount: 1000,
};

describe("evaluateCreditRules", () => {
  it("allows a customer with no balance and no overdue AR", () => {
    expect(evaluateCreditRules(clean)).toEqual([]);
  });

  it("blocks when AR is overdue beyond terms", () => {
    const violations = evaluateCreditRules({ ...clean, overdueAmount: 2500, oldestOverdueDays: 41 });
    expect(violations.map((v) => v.code)).toEqual(["OVERDUE_BEYOND_TERMS"]);
  });

  it("blocks when exposure with the new order exceeds the credit limit", () => {
    const violations = evaluateCreditRules({ ...clean, arBalance: 30000, undeliveredInvoiceTotal: 19500 });
    expect(violations.map((v) => v.code)).toEqual(["CREDIT_LIMIT_EXCEEDED"]);
  });

  it("allows exposure exactly at the credit limit", () => {
    expect(evaluateCreditRules({ ...clean, arBalance: 49000 })).toEqual([]);
  });

  it("ignores the limit when none is set", () => {
    expect(evaluateCreditRules({ ...clean, creditLimit: null, arBalance: 1_000_000 })).toEqual([]);
  });

  it("nets return credits against the balance", () => {
    expect(evaluateCreditRules({ ...clean, creditLimit: 5000, arBalance: 4000, newOrderAmount: 1000 })).toEqual([]);
  });

  it("reports both violations when both rules fail", () => {
    const violations = evaluateCreditRules({
      ...clean,
      creditLimit: 500,
      overdueAmount: 500,
      oldestOverdueDays: 60,
    });
    expect(violations.map((v) => v.code)).toEqual(["OVERDUE_BEYOND_TERMS", "CREDIT_LIMIT_EXCEEDED"]);
  });
});
