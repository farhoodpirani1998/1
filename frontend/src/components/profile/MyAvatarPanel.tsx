import { useRef, useState, ChangeEvent } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { FormError } from '../FormError';
import { useAuth } from '../../lib/auth';
import { useUploadAvatar, useDeleteAvatar } from '../../hooks/useUsers';
import { useToast } from '../../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../../lib/error-handler';

// Sprint A2 — Avatar Management UI. Originally lived inline in
// SettingsPage.tsx (the only "settings" surface that existed at the
// time); Sprint A3 extracts it verbatim into its own component so the
// new My Profile page can reuse it too, without duplicating this logic
// in two places. No behavior change — still reuses useUploadAvatar/
// useDeleteAvatar exactly as before (no new API calls, no
// AvatarStorageService/upload-infrastructure changes here at all).
export function MyAvatarPanel() {
  const { user } = useAuth();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const isBusy = uploadAvatar.isPending || deleteAvatar.isPending;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always reset the input value, even on a rejected/cancelled pick —
    // otherwise choosing the same file twice in a row (e.g. re-picking
    // after a validation error) wouldn't fire onChange the second time.
    e.target.value = '';
    if (!file) {
      return;
    }
    setError(null);
    uploadAvatar.mutate(file, {
      onSuccess: () => showSuccess('آواتار با موفقیت بروزرسانی شد'),
      onError: (err) => {
        setError(parseApiError(err));
        showError(getErrorMessage(err));
      },
    });
  }

  function handleRemove() {
    setError(null);
    deleteAvatar.mutate(undefined, {
      onSuccess: () => showSuccess('آواتار حذف شد'),
      onError: (err) => {
        setError(parseApiError(err));
        showError(getErrorMessage(err));
      },
    });
  }

  return (
    <Card title="آواتار من">
      <p className="mb-4 text-sm text-ink/60 dark:text-paper/60">
        تصویر پروفایل خود را آپلود یا حذف کنید. فرمت‌های مجاز: JPG، PNG، WEBP — حداکثر حجم ۲ مگابایت.
      </p>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <Avatar avatarUrl={user?.avatarUrl} fullName={user?.fullName} size="xl" shape="circle" />

        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            aria-label="انتخاب فایل آواتار"
          />
          <Button
            type="button"
            variant="secondary"
            loading={uploadAvatar.isPending}
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            آپلود آواتار
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteAvatar.isPending}
            disabled={isBusy || !user?.avatarUrl}
            onClick={handleRemove}
          >
            حذف آواتار
          </Button>
        </div>
      </div>

      <FormError error={error} />
    </Card>
  );
}
