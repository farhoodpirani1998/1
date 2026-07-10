# Phase 5B: Parent Tuition & Payments Access

## Overview

Phase 5B extends the parent portal with read-only access to tuition plans, installments, and payment history for their linked children. Parents can track their financial obligations and payment status without modifying data.

## Architecture & Design Principles

### 1. **Authorization & Tenant Isolation**
- All endpoints enforce **role-based access** (`@Roles('parent')`)
- **Tenant safety**: Every query verifies the parent owns the student via the `parent_students` join table
- **School isolation**: All queries filter by `schoolId` from the authenticated user's JWT
- Parents can only access students they are explicitly linked to via `POST /parent/link` (admin-only)

### 2. **Service Reuse**
No new business logic was introduced. The parent service reuses existing query patterns from:
- **TuitionPlansService**: Tenant-safe plan lookup via student join
- **InstallmentsService**: Installation queries with school-scoped filtering
- **PaymentsService**: Payment history retrieval with voided payment exclusion

All queries use the same `.createQueryBuilder()` patterns and filters already proven safe in Phase 4A performance hardening.

### 3. **No Ledger Access**
Parents **cannot** directly read the immutable ledger. Financial data is derived from the canonical entities:
- Tuition plan amounts (base, discount, final)
- Installment status and amounts
- Payment history (excluding voided)

This maintains the separation of concerns: the ledger is an internal audit trail; parents see only the final reconciled state.

## API Endpoints

All endpoints are read-only and require JWT authentication with `role: 'parent'`.

### GET `/parent/students/:id/tuition`
Returns the most recent tuition plan for a student.

**Response:**
```json
{
  "id": "uuid",
  "academicYearTitle": "1405-1406",
  "baseAmount": 100000000,
  "discountAmount": 10000000,
  "finalAmount": 90000000,
  "createdAt": "2025-10-01T10:00:00Z"
}
```

**Access Control:**
- Parent must be linked to the student
- Both parent and student must belong to the same school
- Returns 404 if not linked or from different school

---

### GET `/parent/students/:id/installments`
Returns all installments for a student's tuition plan, sorted by due date.

**Response:**
```json
[
  {
    "id": "uuid",
    "installmentNumber": 1,
    "amount": 30000000,
    "paidAmount": 0,
    "remainingAmount": 30000000,
    "status": "pending",
    "dueDate": "2026-10-01"
  },
  ...
]
```

**Field Meanings:**
- `status`: One of `pending`, `partial`, `paid`, `overdue`, `cancelled`, `deferred`, `disputed`
- `remainingAmount`: Calculated as `max(0, amount - paidAmount)`
- Installments are sorted by due date (earliest first)

**Access Control:** Same as tuition endpoint

---

### GET `/parent/students/:id/payments`
Returns payment history for a student's tuition plan, most recent first. Excludes voided payments.

**Response:**
```json
[
  {
    "id": "uuid",
    "installmentId": "uuid",
    "amount": 15000000,
    "paymentMethod": "cash",
    "paidAt": "2025-10-15T14:30:00Z",
    "receiptNumber": "1405-000001"
  },
  ...
]
```

**Field Meanings:**
- `paymentMethod`: One of `cash`, `card_to_card`, `cheque`, or `null`
- `receiptNumber`: School-specific receipt ID (format: `<jalali-year>-<6-digit-sequence>`)
- Voided payments are **not** included (filtered via `payment.deletedAt IS NULL`)

**Access Control:** Same as tuition endpoint

---

## Implementation Details

### New Files

#### DTOs
- **`src/modules/parent/dto/parent-tuition-view.dto.ts`**  
  Data transfer object for tuition plan views. Includes helper function `toParentTuitionView()` to transform entities to DTO shape.

- **`src/modules/parent/dto/parent-installments-view.dto.ts`**  
  Installment view with calculated fields. `toParentInstallmentView()` computes `remainingAmount`.

- **`src/modules/parent/dto/parent-payments-view.dto.ts`**  
  Payment view excluding sensitive fields (who received it, void reason). Filters voided payments at query time.

#### Tests
- **`test/parent-tuition-access.e2e-spec.ts`**  
  Comprehensive end-to-end test suite covering:
  - All three new endpoints
  - Authorization checks (parent-only role)
  - Tenant isolation (multi-school scenario)
  - Access control (linked vs. unlinked students)
  - Data integrity (amounts, remaining balance, payment sorting)
  - Error cases (404 for unlinked/non-existent students)

### Modified Files

#### `src/modules/parent/parent.service.ts`
Added three new methods:
- **`getStudentTuition(studentId, parentId, schoolId)`**  
  Fetches the most recent tuition plan using a tenant-safe join pattern.

- **`getStudentInstallments(studentId, parentId, schoolId)`**  
  Fetches all installments for a student, sorted by due date and installment number. Excludes soft-deleted payments.

- **`getStudentPaymentHistory(studentId, parentId, schoolId)`**  
  Fetches all non-voided payments, sorted by payment date (most recent first).

All methods:
1. Call `findMyStudent()` to verify the parent owns the student (double-checks school membership too)
2. Build a tenant-safe query using `createQueryBuilder()` with explicit school filters
3. Throw `NotFoundException` if the student doesn't exist or isn't owned by the parent

#### `src/modules/parent/parent.controller.ts`
Added three new endpoints:
- `GET /parent/students/:id/tuition`
- `GET /parent/students/:id/installments`
- `GET /parent/students/:id/payments`

Each endpoint:
1. Extracts the authenticated parent's `id` and `schoolId` from JWT
2. Calls the corresponding service method
3. Transforms the result using DTOs
4. Returns the DTO shape to the client

#### `src/modules/parent/parent.module.ts`
Added imports for `TuitionPlan`, `Installment`, and `Payment` entities so they are available to the parent service.

#### `test/setup/factories.ts`
Added:
- **`createPayment()` factory** to create test payments with configurable amounts, methods, and dates
- Import of `Payment` and `PaymentMethod` from tuition module

## Query Patterns

All queries follow the established tenant-safe pattern:

```typescript
await this.repo
  .createQueryBuilder('entity')
  .innerJoin('entity.association', 'assoc')
  .innerJoin('assoc.student', 'student')  // <-- The key: always join to student
  .where('entity.studentId = :studentId', { studentId })
  .andWhere('student.schoolId = :schoolId', { schoolId })  // <-- Always filter by schoolId
  .getMany();
```

This ensures:
1. A school's admin **cannot** enumerate another school's data by guessing UUIDs
2. Soft-deletes (voided payments) are excluded automatically when not loading explicitly
3. Results are tied to the authenticated user's school context

## Authorization Matrix

| Endpoint | Role Required | Parent Linked? | Same School? | Result |
|----------|---------------|----------------|--------------|--------|
| `/parent/students/:id/tuition` | `parent` | Yes | Yes | 200 ✓ |
| `/parent/students/:id/tuition` | `parent` | No | Yes | 404 ✗ |
| `/parent/students/:id/tuition` | `parent` | Yes | No | 404 ✗ |
| `/parent/students/:id/tuition` | `admin` | Yes | Yes | 403 ✗ |
| All endpoints | (any) | — | — | 401 ✗ (no auth) |

---

## Testing

### Test Suite: `test/parent-tuition-access.e2e-spec.ts`

**Setup:**
- Two schools (A, B)
- Two parents (one per school)
- Three students (two in A, one in B)
- Three tuition plans (one per student)
- Parent-student links established

**Test Groups:**

1. **GET /parent/students/:id/tuition**
   - ✓ Parent can view linked student tuition
   - ✗ Parent cannot view unlinked student
   - ✗ Parent cannot view student from other school
   - ✗ Returns 404 for non-existent student

2. **GET /parent/students/:id/installments**
   - ✓ Parent can view linked student installments
   - ✓ Remaining amount calculated correctly
   - ✗ Parent cannot view unlinked student
   - ✗ Parent cannot view student from other school
   - ✓ Returns empty array for student without installments

3. **GET /parent/students/:id/payments**
   - ✓ Returns empty array when no payments
   - ✓ Parent can view payment history
   - ✓ Payments sorted by date (most recent first)
   - ✗ Parent cannot view unlinked student
   - ✗ Parent cannot view student from other school

4. **Tenant Isolation**
   - Cross-school access denied for all three endpoints

5. **Authorization**
   - Non-parent roles (e.g., admin) denied with 403
   - Unauthenticated requests denied with 401

6. **Multiple Students**
   - Parent can independently access each linked student

### Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run only Phase 5B parent tuition tests
npm run test:e2e -- parent-tuition-access

# Run with coverage
npm run test:coverage
```

## Error Responses

### 401 Unauthorized
No JWT token provided or token is invalid/expired.
```json
{ "statusCode": 401, "message": "Unauthorized" }
```

### 403 Forbidden
User role does not have access to the endpoint.
```json
{ "statusCode": 403, "message": "Forbidden" }
```

### 404 Not Found
Student not found, parent not linked to student, or student from different school.
```json
{ "statusCode": 404, "message": "دانش‌آموز یافت نشد" }
```

## Performance Considerations

1. **Pagination**: Not implemented for parent endpoints (typically small datasets: 1–10 students per parent, 3–12 installments per plan, handful of payments).
   - If needed in future, can add `?limit=20&offset=0` query params and reuse `normalizePagination()` from common/utils.

2. **Eager Loading**: Installments query includes related payments but only non-deleted ones.
   - The `andWhere('payments.deletedAt IS NULL')` clause ensures soft-deleted rows are filtered.

3. **Query Cost**:
   - Tuition: 1 query (2 joins)
   - Installments: 1 query (3 joins, N payments each)
   - Payments: 1 query (3 joins)

All queries are indexed on `student_id`, `school_id`, `tuition_plan_id`, and `deleted_at` from Phase 4A migrations.

## Security Notes

### What Parents Can See
- Tuition plan amounts (base, discount, final)
- Installment due dates and statuses
- Payment history (what was paid, when, by what method)

### What Parents Cannot See
- Discount reasons (admin field)
- Who received the payment (sensitive)
- Payment voiding details
- Ledger entries (internal audit trail)
- Other parents' or students' data

### Invariants Maintained
1. **Tenant isolation**: Parents cannot query across school boundaries
2. **Linking requirement**: Parents can only see students they own
3. **Immutability**: All parent endpoints are read-only
4. **Audit trail**: All access is logged via the existing audit system

## Future Enhancements

1. **Payment Receipts**: `GET /parent/students/:id/payments/:paymentId/receipt` to download a PDF receipt (currently returns clean JSON data)

2. **Notifications**: Trigger payment reminders via SMS/email when installments are due or overdue

3. **Mobile App**: Companion mobile app using these read-only APIs

4. **Analytics**: Dashboard showing parent-visible payment trends (on-time rate, avg outstanding balance)

## Backwards Compatibility

- No breaking changes to existing endpoints
- No database migrations required (uses existing tables)
- Existing parent endpoints unchanged:
  - `GET /parent/students` (list all linked students)
  - `GET /parent/students/:id` (view specific student)
  - `POST /parent/link` (admin-only: create link)
  - `DELETE /parent/link/:id` (admin-only: remove link)

---

## Summary

Phase 5B adds secure, read-only access to tuition and payment data for parents. The implementation:

✅ Reuses existing query patterns and services (no code duplication)  
✅ Maintains tenant isolation and school safety  
✅ Enforces strict authorization (parent role, linked student, same school)  
✅ Provides comprehensive error handling  
✅ Includes extensive end-to-end tests  
✅ Calculates useful fields (remaining balance) for parent convenience  
✅ Excludes sensitive fields (discount reason, payment receiver, voids)  

Total changes: 4 new files, 2 modified files, ~500 lines of new code + 300+ lines of tests.
