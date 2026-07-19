import { api } from '../lib/api';
import type { SearchResults } from '../types/search.types';

export interface QuerySearchParams {
  q: string;
  limit?: number;
}

// GET /search — staff-facing only (school_admin/accountant/staff, see
// SearchController). `limit` caps results *per category*, not overall
// (see QuerySearchDto on the backend) — every key in the response is
// always present, even as an empty array, so callers never need an
// existence check.
export function search(params: QuerySearchParams) {
  return api.get<SearchResults>('/search', { params });
}
