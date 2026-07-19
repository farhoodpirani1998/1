import { useMemo, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { SkeletonCards } from '../components/Skeleton';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import type { School } from '../types/school.types';
import { useSchools, useCreateSchool, useUpdateSchool, useDeactivateSchool } from '../hooks/useSchools';
import { useUsers } from '../hooks/useUsers';
import { useLinkFounderToSchool, useUnlinkFounderFromSchool } from '../hooks/useFounder';
import { SchoolIcon, CheckIcon, AlertIcon } from '../components/icons/SchoolIcons';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غیرفعال' },
];

// Presentation-only status badge, kept local to this page — same visual
// language as the shared <StatusBadge/> (which is typed for
// InstallmentStatus, not school active/inactive).
function SchoolStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

function SchoolAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action-soft text-sm font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

function toPersianCount(n: number): string {
  return n.toLocaleString('fa-IR');
}

export function SchoolsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const schoolsQuery = useSchools();
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const deactivateSchool = useDeactivateSchool();

  const schools = schoolsQuery.data ?? [];
  const loading = schoolsQuery.isLoading;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  // Search/status filter run entirely client-side over the already-fetched
  // `schools` list — GET /schools has no query params on the backend, so
  // this doesn't call the API again per keystroke.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredSchools = useMemo(() => {
    const q = search.trim();
    return schools.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (
        q &&
        !s.name.includes(q) &&
        !(s.address ?? '').includes(q) &&
        !(s.phone ?? '').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [schools, search, statusFilter]);

  const totalCount = schools.length;
  const activeCount = useMemo(() => schools.filter((s) => s.isActive).length, [schools]);
  const inactiveCount = totalCount - activeCount;

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createSchool.mutate(
      { name, address: address || undefined, phone: phone || undefined },
      {
        onSuccess: () => {
          showSuccess('مدرسه ثبت شد');
          setName('');
          setAddress('');
          setPhone('');
          setShowForm(false);
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  function toggleActive(school: School) {
    if (school.isActive) {
      deactivateSchool.mutate(school.id, {
        onError: (err) => showError(getErrorMessage(err)),
      });
    } else {
      updateSchool.mutate(
        { id: school.id, dto: { isActive: true } },
        { onError: (err) => showError(getErrorMessage(err)) },
      );
    }
  }

  const columns: TableColumn<School>[] = [
    {
      key: 'index',
      header: '#',
      cellClassName: 'tabular text-ink/40 dark:text-paper/40',
      render: (s) => toPersianCount(filteredSchools.indexOf(s) + 1),
    },
    {
      key: 'name',
      header: 'نام',
      render: (s) => (
        <div className="flex items-center gap-3">
          <SchoolAvatar name={s.name} />
          <span className="font-medium text-ink dark:text-paper">{s.name}</span>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'آدرس',
      cellClassName: 'text-ink/70 dark:text-paper/70',
      render: (s) => s.address ?? '—',
    },
    {
      key: 'phone',
      header: 'تلفن',
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (s) => s.phone ?? '—',
    },
    {
      key: 'studentCount',
      header: 'تعداد دانش‌آموز',
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (s) => s.studentCount ?? '—',
    },
    {
      key: 'userCount',
      header: 'تعداد کاربر',
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (s) => s.userCount ?? '—',
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (s) => <SchoolStatusBadge isActive={s.isActive} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (s) => (
        <Button
          variant={s.isActive ? 'secondary' : 'primary'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleActive(s);
          }}
        >
          {s.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="مدارس"
        description="مدیریت مدارس ثبت‌شده در سامانه"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'انصراف' : '+ مدرسه جدید'}
          </Button>
        }
      />

      {loading ? (
        <div className="mb-2">
          <SkeletonCards count={3} />
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="کل مدارس" value={toPersianCount(totalCount)} icon={<SchoolIcon />} />
          <StatCard label="مدارس فعال" value={toPersianCount(activeCount)} accent="paid" icon={<CheckIcon />} />
          <StatCard label="مدارس غیرفعال" value={toPersianCount(inactiveCount)} accent="overdue" icon={<AlertIcon />} />
        </div>
      )}

      {showForm && (
        <Card title="ثبت مدرسه جدید" className="mb-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input required label="نام مدرسه" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام مدرسه" />
            <Input label="آدرس" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="آدرس (اختیاری)" />
            <Input type="tel" inputMode="tel" label="تلفن" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="تلفن (اختیاری)" />
            <div className="col-span-full">
              <FormError error={error} />
              <Button type="submit" loading={createSchool.isPending}>
                {createSchool.isPending ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جستجو با نام، آدرس یا تلفن..."
            containerClassName="w-56 sm:w-64"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            options={STATUS_FILTER_OPTIONS}
            containerClassName="w-36"
          />
        </FilterBar>

        <Table
          stickyHeader
          columns={columns}
          data={filteredSchools}
          rowKey={(s) => s.id}
          loading={loading}
          skeletonRows={5}
          emptyMessage="هنوز مدرسه‌ای ثبت نشده است."
          emptyDescription={hasActiveFilters ? 'برای این جستجو/فیلتر نتیجه‌ای یافت نشد.' : undefined}
          onRowClick={(s) => navigate(`/schools/${s.id}`)}
        />
      </Card>

      <FounderLinkManager schools={schools} />
    </div>
  );
}

// Manages founder <-> school ownership (POST /founder/link, DELETE
// /founder/link/:id — see founder-frontend-prompt.md §3). The backend
// doesn't expose a GET to list a founder's existing links, so this can
// only track links created in the current browser session (kept in
// `createdLinks` below) — it can add a new link and remove one it just
// created, but can't show or remove links made earlier or from another
// session/device. Good enough for the common "just registered this
// founder, now attach their schools" flow; anything beyond that needs a
// backend listing endpoint.
function FounderLinkManager({ schools }: { schools: School[] }) {
  const { showSuccess, showError } = useToast();
  const usersQuery = useUsers();
  const founders = (usersQuery.data ?? []).filter((u) => u.role === 'founder');

  const [founderId, setFounderId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [createdLinks, setCreatedLinks] = useState<{ id: string; founderId: string; schoolId: string }[]>([]);

  const linkMutation = useLinkFounderToSchool();
  const unlinkMutation = useUnlinkFounderFromSchool();

  function handleLink(e: FormEvent) {
    e.preventDefault();
    if (!founderId || !schoolId) return;
    linkMutation.mutate(
      { founderId, schoolId },
      {
        onSuccess: (link) => {
          setCreatedLinks((prev) => [...prev, { id: link.id, founderId, schoolId }]);
          showSuccess('مدرسه به حساب مؤسس متصل شد');
        },
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  function handleUnlink(linkId: string) {
    unlinkMutation.mutate(linkId, {
      onSuccess: () => {
        setCreatedLinks((prev) => prev.filter((l) => l.id !== linkId));
        showSuccess('اتصال حذف شد');
      },
      onError: (err) => showError(getErrorMessage(err)),
    });
  }

  if (founders.length === 0) {
    return null;
  }

  return (
    <Card title="اتصال مدرسه به حساب مؤسس" className="mt-6">
      <p className="mb-4 text-xs text-ink/45 dark:text-paper/45">
        یک مؤسس می‌تواند مالک چند مدرسه باشد. از اینجا مدرسه‌ای را به حساب یک مؤسس متصل کنید.
      </p>
      <form onSubmit={handleLink} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          required
          label="حساب مؤسس"
          value={founderId}
          onChange={(e) => setFounderId(e.target.value)}
          placeholder="انتخاب مؤسس"
          options={founders.map((f) => ({ value: f.id, label: f.fullName }))}
        />
        <Select
          required
          label="مدرسه"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          placeholder="انتخاب مدرسه"
          options={schools.map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="flex items-end">
          <Button type="submit" loading={linkMutation.isPending} fullWidth>
            {linkMutation.isPending ? 'در حال اتصال...' : '+ اتصال مدرسه'}
          </Button>
        </div>
      </form>

      {createdLinks.length > 0 && (
        <div className="mt-5 space-y-2">
          {createdLinks.map((link) => {
            const founder = founders.find((f) => f.id === link.founderId);
            const school = schools.find((s) => s.id === link.schoolId);
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5 text-sm dark:bg-white/5"
              >
                <span className="text-ink/80 dark:text-paper/80">
                  {founder?.fullName ?? '—'} ← {school?.name ?? '—'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={unlinkMutation.isPending}
                  onClick={() => handleUnlink(link.id)}
                >
                  حذف اتصال
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
