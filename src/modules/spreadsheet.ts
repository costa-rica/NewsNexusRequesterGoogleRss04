import ExcelJS from "exceljs";
import { QueryRow } from "../types/query";

function toCellString(value: ExcelJS.CellValue | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "text" in value) {
    return String(value.text).trim();
  }
  return String(value).trim();
}

const REQUIRED_HEADERS = [
  "id",
  "and_keywords",
  "and_exact_phrases",
  "or_keywords",
  "or_exact_phrases",
  "time_range",
];

export async function readQuerySpreadsheet(
  filePath: string,
): Promise<QueryRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Spreadsheet has no worksheets.");
  }

  const headerRow = worksheet.getRow(1);
  const headerMap = new Map<string, number>();

  headerRow.eachCell((cell, colNumber) => {
    const header = toCellString(cell.value).toLowerCase();
    if (header) {
      headerMap.set(header, colNumber);
    }
  });

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headerMap.has(header),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Spreadsheet missing required columns: ${missingHeaders.join(", ")}`,
    );
  }

  const rows: QueryRow[] = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const rowValues = {
      id: toCellString(row.getCell(headerMap.get("id")!).value),
      and_keywords: toCellString(
        row.getCell(headerMap.get("and_keywords")!).value,
      ),
      and_exact_phrases: toCellString(
        row.getCell(headerMap.get("and_exact_phrases")!).value,
      ),
      or_keywords: toCellString(
        row.getCell(headerMap.get("or_keywords")!).value,
      ),
      or_exact_phrases: toCellString(
        row.getCell(headerMap.get("or_exact_phrases")!).value,
      ),
      time_range: toCellString(
        row.getCell(headerMap.get("time_range")!).value,
      ),
    };

    const hasAnyValue = Object.values(rowValues).some((value) => value);
    if (!hasAnyValue) {
      continue;
    }

    const idNumber = Number.parseInt(rowValues.id, 10);

    rows.push({
      id: Number.isNaN(idNumber) ? undefined : idNumber,
      and_keywords: rowValues.and_keywords,
      and_exact_phrases: rowValues.and_exact_phrases,
      or_keywords: rowValues.or_keywords,
      or_exact_phrases: rowValues.or_exact_phrases,
      time_range: rowValues.time_range,
    });
  }

  return rows;
}
