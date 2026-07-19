import { wantsPaginatedResponse, normalizePagination, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './pagination';

describe('wantsPaginatedResponse', () => {
  it('is false when neither page nor limit is passed', () => {
    expect(wantsPaginatedResponse({})).toBe(false);
  });

  it('is false when only limit is passed (getStudents()/getInstallments() raising the cap while expecting a plain array)', () => {
    expect(wantsPaginatedResponse({ limit: 200 })).toBe(false);
  });

  it('is true when page is passed, with or without limit', () => {
    expect(wantsPaginatedResponse({ page: 1 })).toBe(true);
    expect(wantsPaginatedResponse({ page: 2, limit: 10 })).toBe(true);
  });
});

describe('normalizePagination', () => {
  it('defaults to page 1 and DEFAULT_PAGE_LIMIT when nothing is passed', () => {
    expect(normalizePagination({})).toEqual({ page: 1, limit: DEFAULT_PAGE_LIMIT, skip: 0 });
  });

  it('caps an oversized limit at MAX_PAGE_LIMIT', () => {
    expect(normalizePagination({ limit: 10000 })).toEqual({
      page: 1,
      limit: MAX_PAGE_LIMIT,
      skip: 0,
    });
  });

  it('computes skip from page and limit', () => {
    expect(normalizePagination({ page: 3, limit: 20 })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('falls back to defaults for a non-positive page or limit', () => {
    expect(normalizePagination({ page: 0, limit: -5 })).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_LIMIT,
      skip: 0,
    });
  });
});
