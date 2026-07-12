import { useMutation } from '@tanstack/react-query';
import {
  requestPasswordReset,
  type RequestPasswordResetInput,
} from '../api/parentPasswordReset.mock';

// Wraps the mock service in api/parentPasswordReset.mock.ts. When that
// file is swapped for a real API call (see its TODO), nothing here needs
// to change — the mutation just calls whatever requestPasswordReset()
// resolves/rejects with.
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (dto: RequestPasswordResetInput) => requestPasswordReset(dto),
  });
}
