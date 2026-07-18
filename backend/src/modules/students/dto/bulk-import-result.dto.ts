// Per-row outcome of a bulk import — deliberately NOT all-or-nothing.
// Each row is created in its own transaction (via StudentsService.create),
// so row 50 failing (e.g. duplicate nationalId) never rolls back or
// blocks rows 1-49 or 51-500. The caller (frontend) uses `index` to map
// a result back to the original spreadsheet row for a per-row status
// column.
export interface BulkImportRowResult {
  index: number;
  success: boolean;
  studentId?: string;
  fullName?: string;
  error?: string;
}

export interface BulkImportStudentsResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  results: BulkImportRowResult[];
}
