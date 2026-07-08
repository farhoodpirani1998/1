import { api } from '../lib/api';
import type { UserRole, LoginResponse } from '../types/auth.types';

// POST /auth/login — public. Returns { accessToken, user }.
export function login(phone: string, password: string) {
  return api.post<LoginResponse>('/auth/login', { phone, password });
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
