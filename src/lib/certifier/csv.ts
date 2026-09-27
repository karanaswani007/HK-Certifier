export type CsvRow = Record<string, string>;

export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
  errors: Array<{ row: number; message: string }>;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: "CSV is empty" }] };
  }
  const headers = splitCsvLine(lines[0]!).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );
  const rows: CsvRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  if (headers.some((h) => !h)) {
    errors.push({ row: 1, message: "CSV has an empty column header" });
  }
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]!);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows, errors };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StudentRecord = {
  fullName: string;
  email: string;
  phone: string;
  studentId: string;
  college: string;
  course: string;
  branch: string;
  batch: string;
  registrationNumber: string;
  custom: Record<string, string>;
};

export const STANDARD_FIELDS = [
  "full_name",
  "name",
  "email",
  "phone",
  "student_id",
  "college",
  "course",
  "branch",
  "batch",
  "registration_number",
] as const;

export function suggestMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    if (h === "name" || h === "full_name" || h === "student_name") map.full_name = h;
    else if (h === "email" || h === "email_id") map.email = h;
    else if (h === "phone" || h === "mobile") map.phone = h;
    else if (h === "student_id" || h === "id") map.student_id = h;
    else if (h === "college" || h === "institute") map.college = h;
    else if (h === "course" || h === "course_name") map.course = h;
    else if (h === "branch" || h === "department") map.branch = h;
    else if (h === "batch") map.batch = h;
    else if (h === "registration_number" || h === "reg_no" || h === "regno") {
      map.registration_number = h;
    }
  }
  return map;
}

export function validateStudentRow(
  row: CsvRow,
  mapping: Record<string, string>,
  rowNumber: number,
): { record?: StudentRecord; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const get = (field: string) => {
    const col = mapping[field];
    return col ? (row[col] ?? "").trim() : "";
  };
  const fullName = get("full_name") || get("name");
  const email = get("email").toLowerCase();
  if (!fullName) errors.push({ row: rowNumber, message: "Missing student name" });
  if (!email) errors.push({ row: rowNumber, message: "Missing email" });
  else if (!EMAIL_RE.test(email)) errors.push({ row: rowNumber, message: "Invalid email" });

  const mappedCols = new Set(Object.values(mapping));
  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!mappedCols.has(k) && v) custom[k] = v;
  }

  if (errors.length) return { errors };
  return {
    record: {
      fullName,
      email,
      phone: get("phone"),
      studentId: get("student_id"),
      college: get("college"),
      course: get("course"),
      branch: get("branch"),
      batch: get("batch"),
      registrationNumber: get("registration_number"),
      custom,
    },
    errors: [],
  };
}

export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
