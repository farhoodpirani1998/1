import { api } from '../lib/api';

// POST /auth/forgot-password — public. Step 1 of the forgot-password
// flow, shared by every portal (admin/staff, teacher, parent all log in
// through the same POST /auth/login). Always resolves with the same
// { success, message } shape whether or not the phone is registered —
// the backend never confirms which phone numbers exist.
export interface RequestPasswordResetInput {
  phone: string;
}
export interface RequestPasswordResetResult {
  success: boolean;
  message: string;
}
export function requestPasswordReset(dto: RequestPasswordResetInput) {
  return api.post<RequestPasswordResetResult>('/auth/forgot-password', dto);
}

// POST /auth/reset-password — public. Step 2: confirms the SMS code
// from step 1 and sets the new password.
export interface ConfirmPasswordResetInput {
  phone: string;
  code: string;
  newPassword: string;
}
export function confirmPasswordReset(dto: ConfirmPasswordResetInput) {
  return api.post<{ success: true }>('/auth/reset-password', dto);
}
