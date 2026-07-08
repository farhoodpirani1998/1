import * as XLSX from 'xlsx';

/**
 * Exports an array of flat objects to a downloadable .xlsx file.
 * Keys become column headers in the order they appear on the first row.
 */
export function exportToExcel(filename: string, sheetName: string, rows: Record<string, string | number>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
