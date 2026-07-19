// Guardian detail page. Linked from Global Search's "والدین" group
// (GlobalSearch.tsx) — the first staff-facing detail route for a
// guardian; GuardiansPage itself only ever opened this same data in an
// edit modal, never as its own page. Deliberately read-only here (no
// edit form) — GuardiansPage's existing modal remains the one place to
// correct a guardian's contact info, so this page doesn't duplicate that
// UI or its validation.

import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { UsersIcon } from '../components/icons/SchoolIcons';
import { toPersianDigits } from '../lib/format';
import { useGuardian } from '../hooks/useGuardians';

const studentStatusLabels: Record<string, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

function GuardianAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action-soft text-xl font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

export function GuardianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const guardianQuery = useGuardian(id);
  const guardian = guardianQuery.data;

  if (guardianQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="ولی/سرپرست یافت نشد"
            description="ممکن است این رکورد حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="fade-in">
        <div className="mb-6 flex items-center gap-4">
          <div className="skeleton h-14 w-14 rounded-full" />
          <div className="flex-1">
            <div className="skeleton mb-2 h-5 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <Breadcrumb
        className="mb-3"
        items={[{ label: 'والدین', to: '/guardians' }, { label: guardian.fullName }]}
      />

      <div className="mb-6 flex items-center gap-4">
        <GuardianAvatar name={guardian.fullName} />
        <div>
          <h1 className="text-xl font-bold text-ink dark:text-paper">{guardian.fullName}</h1>
          <p className="text-sm text-ink/50 dark:text-paper/50">{toPersianDigits(guardian.phone)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="اطلاعات تماس">
          <InfoRow label="نام کامل" value={guardian.fullName} />
          <InfoRow label="شماره تلفن" value={toPersianDigits(guardian.phone)} />
          <InfoRow label="کد ملی" value={guardian.nationalId ? toPersianDigits(guardian.nationalId) : '—'} />
        </Card>

        <Card title="دانش‌آموزان تحت سرپرستی">
          {!guardian.students || guardian.students.length === 0 ? (
            <EmptyState icon={<UsersIcon size={28} />} message="هیچ دانش‌آموزی به این ولی لینک نشده است." />
          ) : (
            <div className="divide-y divide-line dark:divide-white/10">
              {guardian.students.map((s) => (
                <Link
                  key={s.id}
                  to={`/students/${s.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-action"
                >
                  <span className="text-ink dark:text-paper">{s.fullName}</span>
                  <span className="flex items-center gap-2 text-xs text-ink/45 dark:text-paper/45">
                    {s.gradeTitle && <span>{s.gradeTitle}</span>}
                    <span>{studentStatusLabels[s.status] ?? s.status}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
