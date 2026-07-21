// Response shape for GET /students/:id/account — StudentsService.
// getAccountStatus(). Deliberately not the raw StudentUser/User rows:
// this is a read-only status summary for the "حساب پرتال دانش‌آموز"
// card on StudentDetailPage, same "reshape, don't leak the ORM entity
// as-is" reasoning as StudentParentView elsewhere in this module.
export interface StudentAccountView {
  hasAccount: boolean;
  // Null when hasAccount is false -- there is no User row to read these
  // from yet.
  username: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
}
