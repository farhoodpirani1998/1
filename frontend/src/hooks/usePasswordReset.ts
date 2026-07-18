import { useMutation } from '@tanstack/react-query';
import {
  requestPasswordReset,
  confirmPasswordReset,
  type RequestPasswordResetInput,
  type ConfirmPasswordResetInput,
} from '../api/passwordReset.api';

// Step 1 — request an SMS code. Backed by the real POST
// /auth/forgot-password endpoint (see AuthService.requestPasswordReset).
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (dto: RequestPasswordResetInput) => {
      const { data } = await requestPasswordReset(dto);
      return data;
    },
  });
}

// Step 2 — confirm the code + set a new password. Backed by the real
// POST /auth/reset-password endpoint (see AuthService.resetPassword).
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (dto: ConfirmPasswordResetInput) => {
      const { data } = await confirmPasswordReset(dto);
      return data;
    },
  });
}
