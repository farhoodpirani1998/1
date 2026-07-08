import { useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import type { School } from '../types/school.types';
import { useSchools, useCreateSchool, useUpdateSchool, useDeactivateSchool } from '../hooks/useSchools';

export function SchoolsPage() {
  const { showSuccess, showError } = useToast();
  const schoolsQuery = useSchools();
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const deactivateSchool = useDeactivateSchool();

  const schools = schoolsQuery.data ?? [];
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

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

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">مدارس</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {showForm ? 'انصراف' : '+ مدرسه جدید'}
        </button>
      </div>

      {showForm && (
        <Card title="ثبت مدرسه جدید" className="mb-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="نام مدرسه" className="input" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="آدرس (اختیاری)" className="input" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="تلفن (اختیاری)" className="input" />
            <div className="col-span-full">
              <FormError error={error} />
              <button
                type="submit"
                disabled={createSchool.isPending}
                className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {createSchool.isPending ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-ink/50">
              <th className="py-2 font-medium">نام</th>
              <th className="py-2 font-medium">آدرس</th>
              <th className="py-2 font-medium">تلفن</th>
              <th className="py-2 font-medium">وضعیت</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-line/60 last:border-0">
                <td className="py-3 font-medium text-ink">{s.name}</td>
                <td className="py-3 text-ink/70">{s.address ?? '—'}</td>
                <td className="py-3 text-ink/70">{s.phone ?? '—'}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${s.isActive ? 'bg-paid/10 text-paid' : 'bg-overdue/10 text-overdue'}`}>
                    {s.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="py-3 text-left">
                  <button onClick={() => toggleActive(s)} className="text-xs text-action hover:underline">
                    {s.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>
            ))}
            {schools.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-ink/50">
                  هنوز مدرسه‌ای ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
