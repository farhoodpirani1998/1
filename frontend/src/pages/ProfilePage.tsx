import { useState, useEffect, FormEvent } from 'react';
import { Card } from '../components/Card';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { FormError } from '../components/FormError';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { AlertIcon, LockIcon } from '../components/icons/SchoolIcons';
import { MyAvatarPanel } from '../components/profile/MyAvatarPanel';
import { roleLabels } from '../components/Topbar';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { useMyProfile, useUpdateMyProfile, useChangePassword } from '../hooks/useUsers';

// Sprint A3 — My Profile. Shared self-service account page for every
// authenticated role (super_admin/school_admin/accountant/staff/
// teacher/parent/student/founder alike) — see App.tsx for the four
// /profile route registrations. Deliberately holds only account-level
// data (name/username/phone/role/school/avatar/password) — no
// role-specific data (classes, grades, linked students, etc.), which
// stays on each portal's own dedicated pages.
export function ProfilePage() {
  return (
    <div className="fade-in">
      <WorkspaceHeader title="پروفایل من" subtitle="مدیریت اطلاعات حساب کاربری و رمز عبور" />

      <div className="mb-6">
        <MyAvatarPanel />
      </div>
      <div className="mb-6">
        <AccountInfoPanel />
      </div>
      <ChangePasswordPanel />
    </div>
  );
}

// Full name / phone are editable; username/role/school are read-only
// (no route lets any role edit those — username is provisioning-only,
// role/schoolId are never user-editable at all, see UpdateProfileDto).
function AccountInfoPanel() {
  const profileQuery = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { showSuccess, showError } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  // Seed the editable fields once the profile loads, without clobbering
  // whatever the user is mid-typing on a later refetch — same pattern
  // as SettingsPage's SchoolLogoPanel.
  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.fullName);
      setPhone(profileQuery.data.phone ?? '');
    }
  }, [profileQuery.data]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedPhone = phone.trim();
    updateProfile.mutate(
      {
        fullName: fullName.trim(),
        // Only sent if it actually changed from what loaded — omitting
        // an unset field on this DTO leaves it untouched server-side,
        // same "only send what changed" shape UpdateProfileDto expects.
        ...(trimmedPhone !== (profileQuery.data?.phone ?? '') ? { phone: trimmedPhone } : {}),
      },
      {
        onSuccess: () => showSuccess('اطلاعات حساب بروزرسانی شد'),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  if (profileQuery.isLoading) {
    return (
      <Card title="اطلاعات حساب">
        <SkeletonRows rows={4} cols={1} />
      </Card>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card title="اطلاعات حساب">
        <div role="alert">
          <EmptyState
            icon={<AlertIcon size={28} />}
            message="خطا در بارگذاری اطلاعات حساب"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => profileQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </div>
      </Card>
    );
  }

  const profile = profileQuery.data;

  return (
    <Card title="اطلاعات حساب">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          required
          label="نام و نام خانوادگی"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="نام و نام خانوادگی"
          maxLength={150}
        />
        <Input
          type="tel"
          inputMode="tel"
          label="شماره تلفن"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="شماره تلفن"
          helperText={profile.phone ? undefined : 'برای این حساب شماره تلفنی ثبت نشده است.'}
        />

        {/* Read-only fields — no route accepts an edit to any of these
            from a self-service caller. */}
        <ReadOnlyField label="نام کاربری" value={profile.username ?? '—'} />
        <ReadOnlyField label="نقش" value={roleLabels[profile.role] ?? profile.role} />
        {profile.schoolName && <ReadOnlyField label="مدرسه" value={profile.schoolName} />}

        <div className="sm:col-span-2">
          <FormError error={error} />
          <Button type="submit" loading={updateProfile.isPending}>
            {updateProfile.isPending ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">{label}</div>
      <div className="input flex items-center bg-paper/60 text-ink/60 dark:bg-white/[0.03] dark:text-paper/60">
        {value}
      </div>
    </div>
  );
}

// POST /auth/change-password — already existed on the backend for
// every role, just had no frontend caller until this sprint.
function ChangePasswordPanel() {
  const changePassword = useChangePassword();
  const { showSuccess, showError } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError({ kind: 'validation', messages: ['رمز عبور جدید و تکرار آن یکسان نیستند'] });
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          resetForm();
          showSuccess('رمز عبور با موفقیت تغییر کرد');
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <Card title="تغییر رمز عبور">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          required
          type="password"
          label="رمز عبور فعلی"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          containerClassName="sm:col-span-2"
        />
        <Input
          required
          type="password"
          label="رمز عبور جدید"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="حداقل ۸ کاراکتر"
          minLength={8}
        />
        <Input
          required
          type="password"
          label="تکرار رمز عبور جدید"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
        />

        <div className="sm:col-span-2">
          <FormError error={error} />
          <Button type="submit" variant="secondary" loading={changePassword.isPending} leftIcon={<LockIcon size={16} />}>
            {changePassword.isPending ? 'در حال تغییر...' : 'تغییر رمز عبور'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
