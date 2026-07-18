// Sprint 2 (Educational Operations): guardian file management
// ("تکمیل مدیریت پرونده ولی"). Backend: GuardiansController
// (GET/GET-one/PATCH /guardians) — see
// backend/src/modules/students/guardians.controller.ts. A guardian's
// own record (fullName/phone/nationalId) is created only as a side
// effect of registering a student (StudentsPage's "new guardian" path)
// or reused by phone when a sibling enrolls; this page is the first and
// only place to browse guardians directly, see who they're linked to,
// and correct their contact info afterward.

import { useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { Pagination } from '../components/Pagination';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { FormError } from '../components/FormError';
import { EmptyState } from '../components/EmptyState';
import { UsersIcon } from '../components/icons/SchoolIcons';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, type ParsedApiError } from '../lib/error-handler';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGuardians, useGuardian, useUpdateGuardian } from '../hooks/useGuardians';
import type { Guardian, UpdateGuardianInput } from '../api/guardians.api';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const studentStatusLabels: Record<string, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

export function GuardiansPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const guardiansQuery = useGuardians({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page,
    limit: PAGE_SIZE,
  });

  const guardians = guardiansQuery.data ?? [];
  const hasNextPage = guardians.length === PAGE_SIZE;

  const columns: TableColumn<Guardian>[] = [
    { key: 'fullName', header: 'نام و نام خانوادگی', render: (g) => g.fullName },
    { key: 'phone', header: 'شماره تماس', cellClassName: 'tabular', render: (g) => g.phone },
    {
      key: 'nationalId',
      header: 'کد ملی',
      cellClassName: 'tabular text-ink/60 dark:text-paper/60',
      render: (g) => g.nationalId ?? '—',
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (g) => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedId(g.id)}>
          مشاهده پرونده
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="پرونده والدین" description="مشاهده و ویرایش اطلاعات والدین و دانش‌آموزان مرتبط" />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="جستجو بر اساس نام یا شماره تماس..."
          containerClassName="w-64"
        />
      </FilterBar>

      <Card>
        {guardiansQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری فهرست والدین"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => guardiansQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={guardians}
            rowKey={(g) => g.id}
            loading={guardiansQuery.isLoading}
            onRowClick={(g) => setSelectedId(g.id)}
            emptyIcon={<UsersIcon />}
            emptyMessage="والدی یافت نشد."
            emptyDescription={debouncedSearch ? 'جستجوی دیگری را امتحان کنید.' : 'والدین همراه ثبت دانش‌آموز ایجاد می‌شوند.'}
          />
        )}
      </Card>

      <Pagination page={page} onChange={setPage} hasNextPage={hasNextPage} />

      <GuardianDetailModal guardianId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function GuardianDetailModal({ guardianId, onClose }: { guardianId: string | null; onClose: () => void }) {
  const { showSuccess, showError } = useToast();
  const guardianQuery = useGuardian(guardianId ?? undefined);
  const updateGuardian = useUpdateGuardian();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  const guardian = guardianQuery.data;

  function startEditing() {
    if (!guardian) return;
    setFullName(guardian.fullName);
    setPhone(guardian.phone);
    setNationalId(guardian.nationalId ?? '');
    setError(null);
    setEditing(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guardianId) return;
    setError(null);
    const dto: UpdateGuardianInput = { fullName, phone, nationalId: nationalId || undefined };
    updateGuardian.mutate(
      { id: guardianId, dto },
      {
        onSuccess: () => {
          showSuccess('اطلاعات والد به‌روزرسانی شد');
          setEditing(false);
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <Modal
      open={!!guardianId}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      title={editing ? 'ویرایش اطلاعات والد' : guardian?.fullName ?? 'پرونده والد'}
      size="md"
    >
      {guardianQuery.isLoading ? (
        <p className="text-sm text-ink/55 dark:text-paper/55">در حال بارگذاری...</p>
      ) : guardianQuery.isError ? (
        <p className="text-sm text-overdue">خطا در بارگذاری اطلاعات این والد.</p>
      ) : !guardian ? null : editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="نام و نام خانوادگی" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="شماره تماس" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="کد ملی" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          <FormError error={error} />
          <div className="flex gap-2">
            <Button type="submit" loading={updateGuardian.isPending}>
              ذخیره تغییرات
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              انصراف
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-ink/45 dark:text-paper/45">شماره تماس</div>
              <div className="tabular mt-0.5 font-medium text-ink dark:text-paper">{guardian.phone}</div>
            </div>
            <div>
              <div className="text-ink/45 dark:text-paper/45">کد ملی</div>
              <div className="tabular mt-0.5 font-medium text-ink dark:text-paper">{guardian.nationalId ?? '—'}</div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink dark:text-paper">دانش‌آموزان مرتبط</h4>
            {!guardian.students || guardian.students.length === 0 ? (
              <p className="text-sm text-ink/50 dark:text-paper/50">هیچ دانش‌آموزی به این والد متصل نیست.</p>
            ) : (
              <ul className="space-y-2">
                {guardian.students.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm dark:border-white/10"
                  >
                    <span className="font-medium text-ink dark:text-paper">{s.fullName}</span>
                    <span className="text-xs text-ink/50 dark:text-paper/50">
                      {s.gradeTitle ?? s.gradeId} · {studentStatusLabels[s.status] ?? s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button variant="secondary" onClick={startEditing}>
            ویرایش اطلاعات
          </Button>
        </div>
      )}
    </Modal>
  );
}
