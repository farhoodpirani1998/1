// Phase 4B: "export all matching rows" needs every row that matches the
// current filters, not just the page currently on screen — but the
// backend's MAX_PAGE_LIMIT (200, see backend/src/common/utils/pagination.ts)
// is intentionally kept in place rather than raised for this, since that
// cap is what stops an unbounded query from loading a whole table in one
// request (the exact bug Phase 4A fixed). Instead, this loops the same
// paginated endpoint at the max page size until every row is collected.
//
// For a school with a few thousand rows this is a handful of requests
// (e.g. 3,000 installments = 15 requests of 200), which is a reasonable
// cost for an explicit "export" action a user clicks once — very
// different from an unbounded query running on every page load.
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  limit = 200,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const { data, total } = await fetchPage(page, limit);
    all.push(...data);
    if (data.length === 0 || all.length >= total) break;
    page += 1;
  }
  return all;
}
