// ---------------------------------------------------------------------
// Parent password-reset service — TEMPORARY MOCK.
//
// There is no password-reset endpoint on the backend today. AuthController
// only exposes POST /auth/login, POST /auth/register (super_admin-only),
// and POST /auth/change-password (requires an existing session) — none of
// which cover "I forgot my password and I'm signed out." Per project
// rules, that call is not invented against the real API; this file mocks
// the request/response shape a real endpoint would have, so the rest of
// the app (the page, its loading/success/error states) is written exactly
// as if the real thing existed.
//
// TODO(backend): once a real endpoint exists (e.g. POST
// /auth/forgot-password), this is the ONLY file that needs to change —
// replace the mock body of requestPasswordReset() below with a real
// api.post() call, matching the api/*.api.ts pattern used everywhere else
// in this project (see api/auth.api.ts). The function's signature and
// return shape should stay the same so ParentForgotPasswordPage and
// hooks/usePasswordReset.ts need no changes.
// ---------------------------------------------------------------------

export interface RequestPasswordResetInput {
  phone: string;
}

export interface RequestPasswordResetResult {
  success: boolean;
  // Persian, user-facing message — same "message already in Persian"
  // convention the real backend uses elsewhere (see lib/error-handler.ts
  // header comment on BackendErrorBody.message).
  message: string;
}

const MOCK_NETWORK_DELAY_MS = 900;

// Mimics a real backend's behavior of not confirming whether a phone
// number is registered (prevents account enumeration) — always resolves
// with the same success message regardless of input, same as a real
// forgot-password endpoint should. Simulates a rejected promise only for
// a malformed phone number, standing in for a 400 validation response.
export async function requestPasswordReset(
  dto: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));

  const isPlausiblePhone = /^0\d{10}$/.test(dto.phone.trim());
  if (!isPlausiblePhone) {
    throw new Error('شماره تلفن معتبر نیست.');
  }

  return {
    success: true,
    message: 'در صورتی که این شماره در سامانه ثبت شده باشد، لینک بازیابی رمز عبور برای آن پیامک می‌شود.',
  };
}
