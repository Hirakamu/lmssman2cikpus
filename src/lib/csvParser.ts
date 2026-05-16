import * as fs from "fs";

export interface ParseCSVOptions {
  header?: boolean;
  delimiter?: string;
  skipEmptyLines?: boolean;
}

function parseRow(line: string, delimiter: string = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        fields.push(current.trim());
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function splitRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      rows.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0) rows.push(current);
  return rows;
}

export function parseCSV(
  input: string,
  options: ParseCSVOptions & { header: false }
): string[][];

export function parseCSV(
  input: string,
  options?: ParseCSVOptions & { header?: true }
): Record<string, string>[];

export function parseCSV(
  input: string,
  options: ParseCSVOptions = {}
): Record<string, string>[] | string[][] {
  const { header = true, delimiter = ",", skipEmptyLines = true } = options;

  let raw = input;
  if (!input.includes("\n") && fs.existsSync(input)) {
    raw = fs.readFileSync(input, "utf8");
  }

  let rows = splitRows(raw);
  if (skipEmptyLines) { rows = rows.filter((r) => r.trim().length > 0); }
  if (rows.length === 0) return [];
  if (!header) { return rows.map((row) => parseRow(row, delimiter)); }

  const headers = parseRow(rows[0], delimiter);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseRow(rows[i], delimiter);
    const obj: Record<string, string> = {};
    headers.forEach((key, idx) => {
      obj[key] = values[idx] !== undefined ? values[idx] : "";
    });
    data.push(obj);
  }

  return data;
}