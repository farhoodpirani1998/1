import { useState } from 'react';
import type { SortDirection } from '../components/Table';

export interface TableSortState {
  key: string;
  direction: SortDirection;
}

// Shared toggle-cycle for a single sortable column: asc -> desc -> none
// (clicking a different column always starts it at asc). Table.tsx stays
// a dumb/presentational component — it just renders whatever `sort`
// state is handed to it — the actual comparator/sorting of the data
// array lives in each page, same as pagination already works today.
export function useTableSort() {
  const [sort, setSort] = useState<TableSortState | null>(null);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  return { sort, toggleSort };
}
