import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { SkeletonRows } from '../components/Skeleton';
import { useToast } from '../lib/toast';
import { getErrorMessage } from '../lib/error-handler';
import { useStudents, useRestoreStudent } from '../hooks/useStudents';

// NOTE: the backend has no soft-delete "archive" listing endpoint and no
// /restore route (see Audit-Phase0 report, mismatch #4) — those calls
// would 404. This page is repurposed to do the equivalent job with what
// the backend actually supports: list students whose *status* is
// withdrawn/graduated (GET /students?status=...), and "restore" them by
// setting status back to active (PATCH /students/:id, which is
// supported). If true soft-delete archival is later added to the
// backend, swap the two calls below for it — see students.api.ts.
export function ArchivedStudentsPage() {
  const { showSuccess, showError } = useToast();
  const withdrawnQuery = useStudents({ status: 'withdrawn' });
  const graduatedQuery = useStudents({ status: 'graduated' });
  const restoreStudent = useRestoreStudent();

  const loading = withdrawnQuery.isLoading || graduatedQuery.isLoading;
  const students = [...(withdrawnQuery.data ?? []), ...(graduatedQuery.data ?? [])];

  function handleRestore(id: string) {
    restoreStudent.mutate(id, {
      onSuccess: () => showSuccess('دانش‌آموز به وضعیت فعال بازگردانده شد'),
      onError: (err) => showError(getErrorMessage(err)),
    });
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-bold text-ink">دانش‌آموزان غیرفعال</h1>
        <Link to="/students" className="text-sm text-action hover:underline">
          بازگشت به لیست فعال
        </Link>
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink/50">دانش‌آموز غیرفعالی وجود ندارد.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-ink/50">
                <th className="py-2 font-medium">نام</th>
                <th className="py-2 font-medium">پایه</th>
                <th className="py-2 font-medium">وضعیت</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <td className="py-3 font-medium text-ink">{s.fullName}</td>
                  <td className="py-3 text-ink/70">{s.grade?.title ?? '—'}</td>
                  <td className="py-3 text-ink/70">
                    {s.status === 'withdrawn' ? 'انصرافی' : 'فارغ‌التحصیل'}
                  </td>
                  <td className="py-3 text-left">
                    <button onClick={() => handleRestore(s.id)} className="text-xs font-medium text-action hover:underline">
                      بازگردانی به فعال
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
