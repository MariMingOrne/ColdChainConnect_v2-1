export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  required?: boolean;
}

export interface ExcelRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export async function readExcelRows(file: File, columns: ExcelColumn[]): Promise<ExcelRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Please choose an .xlsx file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The file must be smaller than 5 MB.");

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook has no worksheets.");
  if (worksheet.rowCount > 1001 || worksheet.columnCount > 30) {
    throw new Error("Workbook is limited to 1,000 data rows and 30 columns.");
  }

  const headerValues = worksheet.getRow(1).values as unknown[];
  const headers = headerValues.slice(1).map((value) => String(value ?? "").trim());
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new Error("The first row must contain a header for every column.");
  }
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new Error("Column headers must be unique.");
  }

  const columnIndexes = new Map(columns.map((column) => [column.header.toLowerCase(), column]));
  const importedHeaders = new Set(normalizedHeaders);
  const missingHeaders = columns.filter((column) => column.required && !importedHeaders.has(column.header.toLowerCase()));
  if (missingHeaders.length) {
    throw new Error(`Required columns are missing: ${missingHeaders.map((column) => column.header).join(", ")}.`);
  }

  const rows: ExcelRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const worksheetRow = worksheet.getRow(rowNumber);
    const values: Record<string, unknown> = Object.fromEntries(columns.map((column) => [column.key, ""]));
    let hasValue = false;

    headers.forEach((header, index) => {
      const column = columnIndexes.get(header.toLowerCase());
      const cell = worksheetRow.getCell(index + 1);
      if (cell.type === ExcelJS.ValueType.Formula) {
        throw new Error(`Formulas are not allowed in imported files (row ${rowNumber}).`);
      }
      if (!column) return;

      let value: unknown = cell.value;
      if (value instanceof Date) {
        value = value.toISOString().slice(0, 10);
      } else if (value && typeof value === "object") {
        const richText = (value as { richText?: { text: string }[] }).richText;
        value = richText ? richText.map((part) => part.text).join("") : cell.text;
      }
      if (typeof value === "string") value = value.trim();
      if (value !== null && value !== undefined && value !== "") hasValue = true;
      values[column.key] = value ?? "";
    });

    if (hasValue) rows.push({ rowNumber, values });
  }

  return rows;
}

export async function exportExcelFile(
  filename: string,
  worksheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  worksheet.columns = columns.map((column) => ({ ...column, style: { numFmt: "General" } }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.addRows(rows);

  worksheet.eachRow((row) => row.eachCell((cell) => {
    if (typeof cell.value === "string" && /^[\s]*[=+\-@]/.test(cell.value)) {
      cell.value = `'${cell.value}`;
    }
  }));

  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
