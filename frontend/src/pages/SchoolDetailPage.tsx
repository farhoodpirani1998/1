// School detail/settings page. Linked from SchoolsPage's table rows —
// previously a school had no page of its own, only an inline
// activate/deactivate button in the list. This is where a super_admin
// edits name/address/phone and toggles active status for one school.

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { FormError } from '../components/FormError';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { toPersianDigits } from '../lib/format';
import { useSchool, useUpdateSchool, useDeactivateSchool } from '../hooks/useSchools';

function SchoolAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action-soft text-xl font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

function SchoolStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const schoolQuery = useSchool(id);
  const school = schoolQuery.data;
  const updateSchool = useUpdateSchool();
  const deactivateSchool = useDeactivateSchool();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  // Sync the form fields whenever the fetched school changes (first load,
  // or a refetch after another tab/session edited it).
  useEffect(() => {
    if (school) {
      setName(school.name);
      setAddress(school.address ?? '');
      setPhone(school.phone ?? '');
    }
  }, [school]);

  if (schoolQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="مدرسه یافت نشد"
            description="ممکن است این رکورد حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!school) {
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

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    updateSchool.mutate(
      { id, dto: { name, address: address || undefined, phone: phone || undefined } },
      {
        onSuccess: () => showSuccess('تغییرات ذخیره شد'),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  function toggleActive() {
    if (!id || !school) return;
    if (school.isActive) {
      deactivateSchool.mutate(id, { onError: (err) => showError(getErrorMessage(err)) });
    } else {
      updateSchool.mutate(
        { id, dto: { isActive: true } },
        { onError: (err) => showError(getErrorMessage(err)) },
      );
    }
  }

  return (
    <div className="fade-in">
      <Breadcrumb className="mb-3" items={[{ label: 'مدارس', to: '/schools' }, { label: school.name }]} />

      <div className="mb-6 flex items-center gap-4">
        <SchoolAvatar name={school.name} />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink dark:text-paper">{school.name}</h1>
          <SchoolStatusBadge isActive={school.isActive} />
        </div>
        <Button
          variant={school.isActive ? 'secondary' : 'primary'}
          loading={deactivateSchool.isPending || updateSchool.isPending}
          onClick={toggleActive}
        >
          {school.isActive ? 'غیرفعال کردن مدرسه' : 'فعال کردن مدرسه'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="آمار مدرسه">
          <InfoRow label="تعداد دانش‌آموز" value={toPersianDigits(String(school.studentCount ?? 0))} />
          <InfoRow label="تعداد کاربر" value={toPersianDigits(String(school.userCount ?? 0))} />
        </Card>

        <Card title="تنظیمات مدرسه">
          <form onSubmit={handleSave} className="space-y-4">
            <Input required label="نام مدرسه" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="آدرس" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="آدرس (اختیاری)" />
            <Input
              type="tel"
              inputMode="tel"
              label="تلفن"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="تلفن (اختیاری)"
            />
            <FormError error={error} />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={updateSchool.isPending}>
                {updateSchool.isPending ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/schools')}>
                بازگشت به لیست
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
