import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { DensityToggle, type TableDensity } from '../components/DensityToggle';
import { StatCard } from '../components/StatCard';
import { FilterBar } from '../components/FilterBar';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { Table, type TableColumn } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { SkeletonCards } from '../components/Skeleton';
import { InstallmentsIcon, AlertIcon } from '../components/icons/SchoolIcons';
import { formatToman, formatDate, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import { fetchAllPages } from '../lib/fetchAllPages';
import { getInstallmentsPaginated } from '../api/tuition.api';
import type { InstallmentWithStudent, InstallmentStatus } from '../types/tuition.types';
import { useInstallmentsPaginated } from '../hooks/useInstallments';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToast } from '../lib/toast';
import { getErrorMessage } from '../lib/error-handler';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

const statusLabels: Record<InstallmentStatus, string> = {
  overdue: 'معوق',
  pending: 'در انتظار',
  partial: 'پرداخت جزئی',
  paid: 'پرداخت‌شده',
  cancelled: 'لغوشده',
  deferred: 'موکول‌شده',
  disputed: 'مورد اختلاف',
};

const statusOptions: { value: InstallmentStatus | ''; label: string }[] = [
  { value: '', label: 'همه‌ی وضعیت‌ها' },
  { value: 'overdue', label: 'معوق' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'partial', label: 'پرداخت جزئی' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'deferred', label: 'موکول‌شده' },
  { value: 'disputed', label: 'مورد اختلاف' },
  { value: 'cancelled', label: 'لغوشده' },
];

export function InstallmentsPage() {
  const { showError } = useToast();
  const [status, setStatus] = useState<InstallmentStatus | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  // Search is now sent to the backend (see QueryInstallmentsDto.search),
  // so it's debounced the same way StudentsPage debounces its search —
  // otherwise every keystroke would trigger a refetch.
  const debouncedNameFilter = useDebouncedValue(nameFilter, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [payingInstallment, setPayingInstallment] = useState<InstallmentWithStudent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<'all' | 'selected' | null>(null);
  // Sprint A4.1 — Workspace "View controls", the same presentational-only
  // density switch the Student and Teacher Workspaces already use (Table
  // already supported this prop before any page exposed a control for
  // it). No query, filter, sort, or pagination behavior is touched.
  const [density, setDensity] = useState<TableDensity>('comfortable');

  const listParams = {
    ...(status ? { status } : {}),
    ...(debouncedNameFilter ? { search: debouncedNameFilter } : {}),
  };

  // Phase 4B: real server-side pagination — the table only ever holds
  // one page (PAGE_SIZE rows) in memory; `total` is the true count for
  // the current status+search filters, not capped at MAX_PAGE_LIMIT.
  const installmentsQuery = useInstallmentsPaginated(page, PAGE_SIZE, listParams);
  const pageItems = installmentsQuery.data?.data ?? [];
  const totalCount = installmentsQuery.data?.total ?? 0;
  const loading = installmentsQuery.isLoading;

  // Stat cards below are intentionally school-wide (ignore the status
  // dropdown and the search box) rather than "count within whatever's
  // currently filtered" like the old client-side version did — showing
  // e.g. "۰ معوق" just because someone picked "پرداخت‌شده" in the
  // dropdown was more confusing than useful. Cheap: limit=1 still gets
  // an accurate total via getManyAndCount without fetching any rows.
  const totalAllQuery = useInstallmentsPaginated(1, 1, undefined);
  const overdueCountQuery = useInstallmentsPaginated(1, 1, { status: 'overdue' });
  const pendingOnlyCountQuery = useInstallmentsPaginated(1, 1, { status: 'pending' });
  const partialCountQuery = useInstallmentsPaginated(1, 1, { status: 'partial' });

  useEffect(() => {
    setPage(1);
  }, [status, debouncedNameFilter]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        pageItems.forEach((i) => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      pageItems.forEach((i) => next.add(i.id));
      return next;
    });
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // Sprint A4.1 (task 4) — display-only range label for the pagination
  // row below (e.g. "نمایش ۱۶–۳۰ از ۴۲ قسط"), derived from state that
  // already drives Pagination itself. Not a new request and not part of
  // the paging logic — purely what's rendered next to it.
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  // Sprint A4.2 (task 3) — distinguishes "the list is genuinely empty"
  // (no installments exist at all under the current filters) from "a
  // search/status filter just happens to match nothing", same
  // distinction the Student Workspace's isFiltered already makes.
  const isFiltered = Boolean(debouncedNameFilter || status);

  // Sprint A4.2 (task 4) — same "×" affordance already used by the
  // Student Workspace's filter chips and its empty-state "پاک کردن
  // فیلترها" action; both real, query-affecting filters (status,
  // search) reset through the exact setters that already drive
  // listParams above — no new filtering behavior.
  function clearAllFilters() {
    setStatus('');
    setNameFilter('');
  }

  // Sprint A4.2 (task 4) — active filter chips, derived purely from
  // existing filter state (no new query, no new state). Both status and
  // search are real, query-affecting filters (see listParams above), so
  // both get a chip — unlike the Student Workspace's still-unwired status
  // placeholder, there's nothing here to deliberately leave out.
  const activeFilterChips: { key: string; label: string; onClear: () => void }[] = [];
  if (debouncedNameFilter) {
    activeFilterChips.push({
      key: 'search',
      label: `جستجو: «${debouncedNameFilter}»`,
      onClear: () => setNameFilter(''),
    });
  }
  if (status) {
    activeFilterChips.push({
      key: 'status',
      label: `وضعیت: ${statusLabels[status]}`,
      onClear: () => setStatus(''),
    });
  }

  function toExportRows(rows: InstallmentWithStudent[]) {
    return rows.map((i) => ({
      دانش‌آموز: i.tuitionPlan.student.fullName,
      قسط: i.installmentNumber,
      سررسید: i.dueDate,
      'مبلغ (تومان)': i.amount,
      'پرداخت‌شده (تومان)': i.paidAmount,
      وضعیت: statusLabels[i.status],
    }));
  }

  async function handleExport() {
    setExporting('all');
    try {
      const all = await fetchAllPages((p, l) =>
        getInstallmentsPaginated(p, l, listParams).then((res) => res.data),
      );
      exportToExcel('اقساط', 'اقساط', toExportRows(all));
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  async function handleExportSelected() {
    setExporting('selected');
    try {
      // selectedIds can span multiple pages (selection isn't reset on
      // page change), so this needs every matching row, not just the
      // current page, to know which of them are actually selected.
      const all = await fetchAllPages((p, l) =>
        getInstallmentsPaginated(p, l, listParams).then((res) => res.data),
      );
      exportToExcel(
        'اقساط-انتخاب‌شده',
        'اقساط',
        toExportRows(all.filter((i) => selectedIds.has(i.id))),
      );
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const totalAllCount = totalAllQuery.data?.total ?? 0;
  const overdueCount = overdueCountQuery.data?.total ?? 0;
  const pendingCount = (pendingOnlyCountQuery.data?.total ?? 0) + (partialCountQuery.data?.total ?? 0);

  const columns: TableColumn<InstallmentWithStudent>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={toggleSelectAll}
          aria-label="انتخاب همه"
          className="cursor-pointer"
        />
      ),
      align: 'center',
      render: (inst) => (
        <input
          type="checkbox"
          checked={selectedIds.has(inst.id)}
          onChange={() => toggleSelect(inst.id)}
          aria-label="انتخاب ردیف"
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (inst) => (
        <Link to={`/students/${inst.tuitionPlan.student.id}`} className="font-medium text-action hover:underline">
          {inst.tuitionPlan.student.fullName}
        </Link>
      ),
    },
    {
      key: 'number',
      header: 'قسط',
      cellClassName: 'tabular',
      render: (inst) => toPersianDigits(inst.installmentNumber),
    },
    {
      key: 'dueDate',
      header: 'سررسید',
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (inst) => formatDate(inst.dueDate),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      cellClassName: 'tabular font-medium',
      render: (inst) => formatToman(inst.amount),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (inst) => <StatusBadge status={inst.status} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">عملیات</span>,
      align: 'left',
      render: (inst) =>
        inst.status !== 'paid' && inst.status !== 'cancelled' ? (
          <button
            onClick={() => setPayingInstallment(inst)}
            className="text-xs font-medium text-action hover:underline"
          >
            ثبت پرداخت
          </button>
        ) : null,
    },
  ];

  return (
    <div className="fade-in">
      {/* Sprint A4.1 (Installments Workspace) — structured header via the
          same shared <WorkspaceHeader/> the Student and Teacher Workspaces
          use. Live count reuses totalAllQuery (already fetched for the
          "کل اقساط" stat card below) — no new query. This page has no
          "create new" action (installments are generated from tuition
          plans, not created ad-hoc here), so the two export buttons —
          the page's only real actions, unchanged handlers/state — take
          the primary/secondary slots instead, in their original order
          (selected-export first, matching WorkspaceHeader's
          secondaryActions-before-primaryAction convention; full-export
          second). */}
      <WorkspaceHeader
        title="اقساط و پرداخت‌ها"
        subtitle="پیگیری سررسیدها، ثبت پرداخت و خروجی گرفتن از فهرست اقساط"
        countLabel={totalAllQuery.isLoading ? '…' : `${toPersianDigits(totalAllCount)} قسط`}
        countIcon={<InstallmentsIcon size={12} />}
        countAriaLabel="تعداد کل اقساط"
        secondaryActions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportSelected}
            disabled={selectedIds.size === 0 || exporting !== null}
            loading={exporting === 'selected'}
          >
            خروجی انتخاب‌شده‌ها
            {selectedIds.size > 0 ? ` (${toPersianDigits(selectedIds.size)})` : ''}
          </Button>
        }
        primaryAction={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={exporting !== null}
            loading={exporting === 'all'}
          >
            خروجی Excel
          </Button>
        }
      />

      {loading ? (
        <div className="mb-6">
          <SkeletonCards count={3} />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="کل اقساط" value={toPersianDigits(totalAllCount)} />
          <StatCard label="در انتظار پرداخت" value={toPersianDigits(pendingCount)} accent="warning" />
          <StatCard label="معوق" value={toPersianDigits(overdueCount)} accent="overdue" />
        </div>
      )}

      <Card>
        {/* Sprint A4.1 (task 2) — Workspace Toolbar via the shared
            <FilterBar/> instead of a bare instance with no separation
            from the table below. Search comes first (SearchInput, exact
            existing state/handler), then a divider, then the real Filters
            (status Select) — same "Search | Filters" grouping precedent
            as the Student Workspace's toolbar. View controls (density)
            sit in the actions slot, on their own since both real
            "workspace actions" (the exports) already live in the header
            above — nothing here duplicates them.
            Sprint A4.2 (task 4/7) — FilterBar and its new filter-chips
            row now share one bordered zone (same outer wrapper the
            Student Workspace uses), instead of the border living on
            FilterBar alone with no room for a second row underneath it. */}
        <div className="mb-4 flex flex-col border-b border-line pb-4 dark:border-white/10">
          <FilterBar actions={<DensityToggle value={density} onChange={setDensity} />}>
            <SearchInput
              value={nameFilter}
              onChange={setNameFilter}
              placeholder="فیلتر بر اساس نام دانش‌آموز..."
              containerClassName="w-full sm:w-64"
            />

            <span className="hidden h-6 w-px bg-line dark:bg-white/10 sm:inline-block" aria-hidden="true" />

            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as InstallmentStatus | '')}
              options={statusOptions}
              containerClassName="w-auto"
              aria-label="فیلتر وضعیت"
            />
          </FilterBar>

          {/* Sprint A4.2 (task 4) — active filter chips, shown only when a
              real filter is applied; each "×" reuses the exact same
              setState calls as the Select/SearchInput above (or
              clearAllFilters) — no new filtering logic anywhere here. */}
          {activeFilterChips.length > 0 && (
            <div
              role="group"
              aria-label="فیلترهای فعال"
              className="fade-in mt-3 flex flex-wrap items-center gap-2"
            >
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="badge border-action/25 bg-action-soft py-1 pl-1.5 text-action dark:border-action/30 dark:bg-action/10 dark:text-action-light"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onClear}
                    aria-label={`حذف فیلتر ${chip.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-action/70 transition-colors hover:bg-action/15 hover:text-action dark:text-action-light/70 dark:hover:bg-action-light/15 dark:hover:text-action-light"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </span>
              ))}
              {activeFilterChips.length > 1 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md px-2 py-1 text-xs font-medium text-ink/50 transition-colors hover:bg-paper hover:text-ink dark:text-paper/50 dark:hover:bg-white/10 dark:hover:text-paper"
                >
                  پاک کردن همه
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sprint A4.2 (task 1) — this query previously had no error state
            at all: a failed request just silently rendered an empty
            table. Reuses the exact retry convention already used by the
            Student and Teacher Workspaces (EmptyState + AlertIcon + a
            secondary "تلاش مجدد" button calling the query's own refetch)
            — no new request type. Toolbar above stays usable during an
            error so the admin isn't blocked from adjusting filters and
            retrying. */}
        {installmentsQuery.isError ? (
          <EmptyState
            icon={<AlertIcon size={28} />}
            message="خطا در بارگذاری فهرست اقساط"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => installmentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <>
            <Table
              stickyHeader
              density={density}
              columns={columns}
              data={pageItems}
              rowKey={(inst) => inst.id}
              loading={loading}
              skeletonRows={8}
              emptyMessage={isFiltered ? 'قسطی با این مشخصات یافت نشد.' : 'هنوز قسطی ثبت نشده است.'}
              emptyDescription={
                isFiltered
                  ? 'جستجو یا فیلترها را تغییر دهید.'
                  : 'اقساط به‌صورت خودکار از طرح‌های شهریه دانش‌آموزان ایجاد می‌شوند.'
              }
              emptyIcon={isFiltered ? undefined : <InstallmentsIcon size={28} />}
              emptyAction={
                isFiltered ? (
                  <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                    پاک کردن فیلترها
                  </Button>
                ) : undefined
              }
            />

            {/* Sprint A4.1 (task 4) — pagination now sits in its own bordered
                zone (same "mt-4 border-t pt-4" rhythm the Student Workspace
                uses) instead of trailing directly off the table with no
                separation. The range line is display-only, derived from the
                exact same page/PAGE_SIZE/totalCount already driving
                Pagination below it — no new request, no change to paging
                logic itself. */}
            {!loading && totalCount > 0 && (
              <div className="mt-4 border-t border-line pt-4 text-center dark:border-white/10">
                <p className="tabular mb-2 text-xs text-ink/50 dark:text-paper/50">
                  نمایش {toPersianDigits(rangeStart)}–{toPersianDigits(rangeEnd)} از {toPersianDigits(totalCount)} قسط
                </p>
                <Pagination page={page} pageCount={pageCount} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      {payingInstallment && (
        <RecordPaymentModal
          installment={payingInstallment}
          studentName={payingInstallment.tuitionPlan.student.fullName}
          onClose={() => setPayingInstallment(null)}
          onSaved={() => setPayingInstallment(null)}
        />
      )}
    </div>
  );
}
