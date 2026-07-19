/**
 * Phase 4A performance fix: several list endpoints (students, installments,
 * payments) had no pagination at all — `getMany()` with no `take`/`skip`,
 * so a school with a few thousand students/payments would load the entire
 * table into memory on every request. This is a shared, minimal helper so
 * each service applies the same defaults/ceiling instead of hand-rolling
 * slightly different logic per endpoint.
 *
 * Behavior is additive and backward compatible: callers that don't pass
 * `page`/`limit` still get an array back (not a wrapped `{ data, total }`
 * shape), just capped at DEFAULT_LIMIT instead of unbounded.
 */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Real server-side pagination wrapper. Only returned when the caller
 * explicitly passed `page` or `limit` — see `wantsPaginatedResponse()`.
 * Callers that don't ask for pagination keep getting a plain array back
 * (unchanged behavior for every existing consumer of these list
 * endpoints), so this is additive, not a breaking change to the
 * endpoint's default shape.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function wantsPaginatedResponse(params: PaginationParams): boolean {
  return params.page !== undefined || params.limit !== undefined;
}

export function normalizePagination(params: PaginationParams): NormalizedPagination {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const requestedLimit =
    params.limit && params.limit > 0 ? Math.floor(params.limit) : DEFAULT_PAGE_LIMIT;
  const limit = Math.min(requestedLimit, MAX_PAGE_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}
