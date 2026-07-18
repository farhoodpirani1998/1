import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTimetableEntries,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  type QueryTimetableParams,
  type CreateTimetableEntryInput,
  type UpdateTimetableEntryInput,
} from '../api/timetable.api';
import { queryKeys } from '../lib/queryKeys';

export function useAdminTimetable(params?: QueryTimetableParams) {
  return useQuery({
    queryKey: queryKeys.adminTimetable.list(params),
    queryFn: () => getTimetableEntries(params).then((res) => res.data),
  });
}

export function useCreateTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTimetableEntryInput) => createTimetableEntry(dto).then((res) => res.data),
    onSuccess: () => {
      // A new entry can appear in any filtered list (by grade/teacher/
      // academicYear) — invalidate every timetable list rather than
      // guessing which filter combos are affected, same shape as
      // useCreateStudent.
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTimetable.all() });
    },
  });
}

export function useUpdateTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTimetableEntryInput }) =>
      updateTimetableEntry(id, dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTimetable.all() });
    },
  });
}

export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimetableEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTimetable.all() });
    },
  });
}
