import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAttendanceByDate,
  recordAttendance,
  type QueryAttendanceByDateParams,
  type RecordAttendanceInput,
} from '../api/attendance.api';
import { queryKeys } from '../lib/queryKeys';

// GET /attendance/date/:date — only enabled once a date is actually
// chosen (AttendancePage starts with no date selected rather than
// defaulting silently to today, so the admin picks the day on purpose).
export function useAttendanceByDate(date: string, params?: QueryAttendanceByDateParams) {
  return useQuery({
    queryKey: queryKeys.adminAttendance.byDate(date, params),
    queryFn: () => getAttendanceByDate(date, params).then((res) => res.data),
    enabled: !!date,
  });
}

export function useRecordAttendanceAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordAttendanceInput) => recordAttendance(dto).then((res) => res.data),
    onSuccess: (_data, dto) => {
      // Upserts on (studentId, date) on the backend — invalidate every
      // by-date query for that exact date (any grade/academicYear filter
      // combination) via prefix match, same shape as
      // useCreateTeacherAssignment's invalidation.
      queryClient.invalidateQueries({ queryKey: [...queryKeys.adminAttendance.all(), 'byDate', dto.date] });
    },
  });
}
