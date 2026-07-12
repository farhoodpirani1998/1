import { Select } from './Select';
import { useParentStudent } from '../lib/parentStudent';

// Reused by every /parent/* page (Dashboard/Tuition/Installments/
// Payments) — a parent with more than one linked child needs to switch
// between them, and the selection is shared via ParentStudentProvider so
// it doesn't reset when moving between those pages. Renders nothing for
// a parent with exactly one child (nothing to switch between).
export function StudentSwitcher({ className = '' }: { className?: string }) {
  const { students, selectedStudentId, setSelectedStudentId } = useParentStudent();

  if (students.length <= 1) return null;

  return (
    <Select
      value={selectedStudentId ?? ''}
      onChange={(e) => setSelectedStudentId(e.target.value)}
      options={students.map((s) => ({ value: s.id, label: `${s.fullName} — ${s.grade.title}` }))}
      containerClassName={className}
      aria-label="انتخاب دانش‌آموز"
    />
  );
}
