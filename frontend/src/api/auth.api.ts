import { api } from '../lib/api';
import type { UserRole, LoginResponse } from '../types/auth.types';

// POST /auth/login — public. Accepts either `phone` (every existing
// role) or `username` (student-role logins only — see backend LoginDto).
// Kept as one low-level request both login()/loginWithUsername() below
// call, rather than duplicating the axios call in each — same "one
// request shape, two identifiers" split the backend's own LoginDto uses.
function loginRequest(credentials: { phone?: string; username?: string }, password: string) {
  return api.post<LoginResponse>('/auth/login', { ...credentials, password });
}

// Unchanged signature — every existing call site (staff/parent/teacher
// login pages) keeps working exactly as before.
export function login(phone: string, password: string) {
  return loginRequest({ phone }, password);
}

// Student Portal foundation (ADR-001). Student-role users log in with a
// username rather than a phone number (no phone exists on a student-only
// login — see backend LoginDto/AuthService). Kept as a separate function
// rather than overloading login()'s signature, so every existing caller
// of login(phone, password) is untouched.
export function loginWithUsername(username: string, password: string) {
  return loginRequest({ username }, password);
}

// POST /auth/register — super_admin only (@Roles('super_admin') on
// AuthController). This is also the *only* way to create a user; there
// is no POST /users route.
export interface RegisterUserInput {
  schoolId?: string;
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
}
export function register(dto: RegisterUserInput) {
  return api.post('/auth/register', dto);
}

// Sprint A3 — My Profile. POST /auth/change-password — any authenticated
// role (see AuthController.changePassword), already existed on the
// backend with no frontend caller until now.
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
export function changePassword(dto: ChangePasswordInput) {
  return api.post<{ success: true }>('/auth/change-password', dto);
}
