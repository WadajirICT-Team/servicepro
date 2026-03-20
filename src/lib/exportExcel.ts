import * as XLSX from "xlsx";

type Cell = string | number | boolean | null | undefined | Date;

function toDisplayValue(v: Cell): string | number | boolean | Date | "" {
  if (v === null || v === undefined) return "";
  return v;
}

export function exportToXlsx(options: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: Cell[][];
}) {
  const { filename, sheetName = "Sheet1", headers, rows } = options;

  const aoa: (string | number | boolean | Date | "")[][] = [
    headers,
    ...rows.map((r) => r.map(toDisplayValue)),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

