import { useMemo, useState, FormEvent } from 'react';
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
import type { ManagedUser } from '../types/user.types';
import type { School } from '../types/school.types';
import type { UserRole } from '../types/auth.types';
import { useUsers, useCreateUser, useUpdateUser } from '../hooks/useUsers';
import { useSchools } from '../hooks/useSchools';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'مدیر کل',
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
  parent: 'والد',
  // Sprint 1 (Teacher Portal Foundation): teacher accounts aren't created
  // from this page (same as 'parent' above — neither appears in
  // ROLE_FILTER_OPTIONS or the create-role Select below), but this map is
  // typed Record<UserRole, string>, so every role needs an entry here to
  // label a teacher row correctly if/when one shows up in the users list.
  teacher: 'معلم',
};

const ROLE_FILTER_OPTIONS: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: 'همه نقش‌ها' },
  { value: 'super_admin', label: roleLabels.super_admin },
  { value: 'school_admin', label: roleLabels.school_admin },
  { value: 'accountant', label: roleLabels.accountant },
  { value: 'staff', label: roleLabels.staff },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غیرفعال' },
];

// Presentation-only status badge, kept local to this page — same visual
// language as the shared <StatusBadge/> (which is typed for
// InstallmentStatus, not user active/inactive).
function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
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

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.5.3 4.5 2.3 4.5 4.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function UsersPage() {
  const { showSuccess, showError } = useToast();
  const usersQuery = useUsers();
  const schoolsQuery = useSchools();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const users = usersQuery.data ?? [];
  const schools = schoolsQuery.data ?? [];
  const loading = usersQuery.isLoading;

  const [showForm, setShowForm] = useState(false);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);

  // Search/role/status filters run entirely client-side over the
  // already-fetched `users` list — GET /users has no query params on the
  // backend, so this doesn't call the API again per keystroke.
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredUsers = useMemo(() => {
    const q = search.trim();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (q && !u.fullName.includes(q) && !u.phone.includes(q)) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalCount = users.length;
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const inactiveCount = totalCount - activeCount;

  function toggleActive(u: ManagedUser) {
    updateUser.mutate(
      { id: u.id, isActive: !u.isActive },
      { onError: (err) => showError(getErrorMessage(err)) },
    );
  }

  const hasActiveFilters = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  const columns: TableColumn<ManagedUser>[] = [
    {
      key: 'name',
      header: 'نام',
      render: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={u.fullName} />
          <span className="font-medium text-ink dark:text-paper">{u.fullName}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'تلفن',
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (u) => u.phone,
    },
    {
      key: 'role',
      header: 'نقش',
      cellClassName: 'text-ink/70 dark:text-paper/70',
      render: (u) => roleLabels[u.role],
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (u) => <UserStatusBadge isActive={u.isActive} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (u) => (
        <Button variant={u.isActive ? 'secondary' : 'primary'} size="sm" onClick={() => toggleActive(u)}>
          {u.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="کاربران"
        description="مدیریت کاربران سامانه و دسترسی‌های آن‌ها"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'انصراف' : '+ کاربر جدید'}
          </Button>
        }
      />

      {loading ? (
        <div className="mb-2">
          <SkeletonCards count={3} />
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="کل کاربران" value={toPersianCount(totalCount)} icon={<UsersIcon />} />
          <StatCard label="کاربران فعال" value={toPersianCount(activeCount)} accent="paid" icon={<CheckIcon />} />
          <StatCard label="کاربران غیرفعال" value={toPersianCount(inactiveCount)} accent="overdue" icon={<AlertIcon />} />
        </div>
      )}

      {showForm && (
        <CreateUserForm
          schools={schools}
          saving={createUser.isPending}
          error={createError}
          onSubmit={(dto) => {
            setCreateError(null);
            createUser.mutate(dto, {
              onSuccess: () => {
                setShowForm(false);
                showSuccess('کاربر ثبت شد');
              },
              onError: (err) => {
                setCreateError(parseApiError(err));
                showError(getErrorMessage(err));
              },
            });
          }}
        />
      )}

      <Card className="mt-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جستجو با نام یا تلفن..."
            containerClassName="w-56 sm:w-64"
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            options={ROLE_FILTER_OPTIONS}
            containerClassName="w-40"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            options={STATUS_FILTER_OPTIONS}
            containerClassName="w-36"
          />
        </FilterBar>

        <Table
          columns={columns}
          data={filteredUsers}
          rowKey={(u) => u.id}
          loading={loading}
          skeletonRows={5}
          emptyMessage="هنوز کاربری ثبت نشده است."
          emptyDescription={hasActiveFilters ? 'برای این جستجو/فیلتر نتیجه‌ای یافت نشد.' : undefined}
        />
      </Card>
    </div>
  );
}

function CreateUserForm({
  schools,
  saving,
  error,
  onSubmit,
}: {
  schools: School[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (dto: { fullName: string; phone: string; password: string; role: UserRole; schoolId?: string }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('school_admin');
  const [schoolId, setSchoolId] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      fullName,
      phone,
      password,
      role,
      schoolId: role === 'super_admin' ? undefined : schoolId,
    });
  }

  return (
    <Card title="ثبت کاربر جدید" className="mb-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          required
          label="نام و نام خانوادگی"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="نام و نام خانوادگی"
        />
        <Input
          required
          label="شماره تلفن"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="شماره تلفن"
        />
        <Input
          required
          type="password"
          label="رمز عبور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="حداقل ۸ کاراکتر"
        />
        <Select
          label="نقش"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={[
            { value: 'school_admin', label: roleLabels.school_admin },
            { value: 'accountant', label: roleLabels.accountant },
            { value: 'staff', label: roleLabels.staff },
            { value: 'super_admin', label: roleLabels.super_admin },
          ]}
        />

        {role !== 'super_admin' && (
          <Select
            required
            label="مدرسه"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            placeholder="انتخاب مدرسه"
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
            containerClassName="col-span-full"
          />
        )}

        <div className="col-span-full">
          <FormError error={error} />
          <Button type="submit" loading={saving}>
            {saving ? 'در حال ذخیره...' : 'ثبت کاربر'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
