import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Table, type TableColumn } from '../../components/Table';
import { useFounderSchoolStaff } from '../../hooks/useFounder';
import type { FounderStaffMember, FounderStaffRole } from '../../types/founder.types';

const roleLabels: Record<FounderStaffRole, string> = {
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
};

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

// Non-teacher staff (school_admin / accountant / staff) — see
// founder-frontend-prompt.md §2.6.
export function FounderStaffPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const staffQuery = useFounderSchoolStaff(schoolId);
  const staff = staffQuery.data ?? [];
  const loading = staffQuery.isLoading;

  const columns: TableColumn<FounderStaffMember>[] = [
    { key: 'name', header: 'نام', render: (u) => <span className="font-medium text-ink dark:text-paper">{u.fullName}</span> },
    { key: 'phone', header: 'تلفن', cellClassName: 'tabular text-ink/70 dark:text-paper/70', render: (u) => u.phone },
    { key: 'role', header: 'نقش', cellClassName: 'text-ink/70 dark:text-paper/70', render: (u) => roleLabels[u.role] ?? u.role },
    { key: 'status', header: 'وضعیت', render: (u) => <ActiveBadge isActive={u.isActive} /> },
  ];

  return (
    <Card>
      <Table
          stickyHeader
        columns={columns}
        data={staff}
        rowKey={(u) => u.id}
        loading={loading}
        skeletonRows={5}
        emptyMessage="کارمندی برای این مدرسه ثبت نشده است."
      />
    </Card>
  );
}
