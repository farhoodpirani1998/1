// ---------------------------------------------------------------------
// React Query wrappers around the homework mock modules — see
// api/homeworkExtras.mock.ts and api/homeworkSubmissions.mock.ts header
// comments for why these are mocked rather than real API calls. Kept in
// their own hook file rather than folded into hooks/useTeacher.ts so
// it's visually obvious at the import site which homework hooks talk to
// the real backend (useTeacherHomework et al.) and which don't.
// ---------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHomeworkExtras, saveHomeworkExtras } from '../api/homeworkExtras.mock';
import {
  listSubmissions,
  gradeSubmission,
  returnSubmissionForRevision,
  type GradeSubmissionInput,
  type ReturnSubmissionInput,
} from '../api/homeworkSubmissions.mock';
import type { HomeworkExtras } from '../types/homeworkExtras.types';

const homeworkExtrasKey = (homeworkId: string) => ['homeworkExtras', homeworkId] as const;
const homeworkSubmissionsKey = (homeworkId: string) => ['homeworkSubmissions', homeworkId] as const;

export function useHomeworkExtras(homeworkId: string | undefined) {
  return useQuery({
    queryKey: homeworkExtrasKey(homeworkId ?? ''),
    queryFn: () => getHomeworkExtras(homeworkId as string),
    enabled: !!homeworkId,
  });
}

// همیشه بعد از موفقیت createHomework/updateHomework واقعی صدا زده
// می‌شود (id واقعی لازم است) — نه بخشی از فرم ارسال‌شده به بک‌اند.
export function useSaveHomeworkExtras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ homeworkId, extras }: { homeworkId: string; extras: HomeworkExtras }) =>
      saveHomeworkExtras(homeworkId, extras),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: homeworkExtrasKey(variables.homeworkId) });
    },
  });
}

export function useHomeworkSubmissions(homeworkId: string | undefined) {
  return useQuery({
    queryKey: homeworkSubmissionsKey(homeworkId ?? ''),
    queryFn: () => listSubmissions(homeworkId as string),
    enabled: !!homeworkId,
  });
}

export function useGradeSubmission(homeworkId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GradeSubmissionInput) => gradeSubmission(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeworkSubmissionsKey(homeworkId) });
    },
  });
}

export function useReturnSubmission(homeworkId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReturnSubmissionInput) => returnSubmissionForRevision(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeworkSubmissionsKey(homeworkId) });
    },
  });
}
