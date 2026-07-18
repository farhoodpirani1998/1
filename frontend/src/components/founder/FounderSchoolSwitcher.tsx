import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Select } from '../Select';
import { useFounderSchools } from '../../hooks/useFounder';

// Lets a founder with more than one school switch which school's data
// the current page shows. Swaps only the :schoolId segment of the URL
// and keeps the same sub-route (dashboard/students/teachers/staff/
// tuition), so switching schools while on .../students stays on
// .../students for the newly selected school. Renders nothing for a
// founder with exactly one school (nothing to switch between) — same
// convention as StudentSwitcher in the parent portal.
export function FounderSchoolSwitcher({ className = '' }: { className?: string }) {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const schoolsQuery = useFounderSchools();
  const schools = schoolsQuery.data ?? [];

  if (schools.length <= 1) return null;

  function handleChange(nextSchoolId: string) {
    if (!schoolId || nextSchoolId === schoolId) return;
    const nextPath = location.pathname.replace(`/founder/schools/${schoolId}`, `/founder/schools/${nextSchoolId}`);
    navigate(nextPath);
  }

  return (
    <Select
      value={schoolId ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      options={schools.map((s) => ({ value: s.id, label: s.name }))}
      containerClassName={className}
      aria-label="انتخاب مدرسه"
    />
  );
}
