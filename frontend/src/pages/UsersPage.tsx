import { useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { useToast } from '../lib/toast';
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
};

export function UsersPage() {
  const { showSuccess, showError } = useToast();
  const usersQuery = useUsers();
  const schoolsQuery = useSchools();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const users = usersQuery.data ?? [];
  const schools = schoolsQuery.data ?? [];
  const [showForm, setShowForm] = useState(false);

  function toggleActive(u: ManagedUser) {
    updateUser.mutate(
      { id: u.id, isActive: !u.isActive },
      { onError: () => showError('تغییر وضعیت کاربر با خطا مواجه شد') },
    );
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">کاربران</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {showForm ? 'انصراف' : '+ کاربر جدید'}
        </button>
      </div>

      {showForm && (
        <CreateUserForm
          schools={schools}
          saving={createUser.isPending}
          onSubmit={(dto) =>
            createUser.mutate(dto, {
              onSuccess: () => {
                setShowForm(false);
                showSuccess('کاربر ثبت شد');
              },
              onError: () => showError('ثبت کاربر با خطا مواجه شد'),
            })
          }
        />
      )}

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-ink/50">
              <th className="py-2 font-medium">نام</th>
              <th className="py-2 font-medium">تلفن</th>
              <th className="py-2 font-medium">نقش</th>
              <th className="py-2 font-medium">وضعیت</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="py-3 font-medium text-ink">{u.fullName}</td>
                <td className="tabular py-3 text-ink/70">{u.phone}</td>
                <td className="py-3 text-ink/70">{roleLabels[u.role]}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${u.isActive ? 'bg-paid/10 text-paid' : 'bg-overdue/10 text-overdue'}`}>
                    {u.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="py-3 text-left">
                  <button onClick={() => toggleActive(u)} className="text-xs text-action hover:underline">
                    {u.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-ink/50">
                  هنوز کاربری ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CreateUserForm({
  schools,
  saving,
  onSubmit,
}: {
  schools: School[];
  saving: boolean;
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
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی" className="input" />
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره تلفن" className="input" />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="رمز عبور (حداقل ۸ کاراکتر)"
          className="input"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input">
          <option value="school_admin">مدیر مدرسه</option>
          <option value="accountant">حسابدار</option>
          <option value="staff">کارمند</option>
          <option value="super_admin">مدیر کل</option>
        </select>

        {role !== 'super_admin' && (
          <select required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="input col-span-full">
            <option value="">انتخاب مدرسه</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="col-span-full">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره...' : 'ثبت کاربر'}
          </button>
        </div>
      </form>
    </Card>
  );
}
