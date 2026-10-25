import { describe, expect, it } from "vitest";
import { File } from "node:buffer";
import ExcelJS from "exceljs";
import { ExcelColumn, readExcelRows } from "./excel";

const columns: ExcelColumn[] = [
  { header: "Store Name", key: "store_name", required: true },
  { header: "City", key: "location", required: true },
  { header: "Credit Limit", key: "credit_limit" },
];

async function workbookFile(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Customers");
  rows.forEach((row) => worksheet.addRow(row));
  const data = new Uint8Array(await workbook.xlsx.writeBuffer());
  return new File([data], "customers.xlsx");
}

describe("readExcelRows", () => {
  it("maps exported headers and skips empty rows", async () => {
    const file = await workbookFile([
      ["Store Name", "City", "Credit Limit"],
      ["North Market", "Makati", 25000],
      [null, null, null],
    ]);

    await expect(readExcelRows(file as unknown as globalThis.File, columns)).resolves.toEqual([
      { rowNumber: 2, values: { store_name: "North Market", location: "Makati", credit_limit: 25000 } },
    ]);
  });

  it("rejects workbooks missing required headers", async () => {
    const file = await workbookFile([["Store Name", "Credit Limit"], ["North Market", 25000]]);
    await expect(readExcelRows(file as unknown as globalThis.File, columns)).rejects.toThrow("Required columns are missing: City.");
  });

  it("rejects formula cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");
    worksheet.addRow(["Store Name", "City", "Credit Limit"]);
    worksheet.addRow(["North Market", "Makati", { formula: "1+1", result: 2 }]);
    const file = new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "customers.xlsx");
    await expect(readExcelRows(file as unknown as globalThis.File, columns)).rejects.toThrow("Formulas are not allowed in imported files (row 2).");
  });
});
