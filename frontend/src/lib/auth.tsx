import { createContext, useContext, useState, ReactNode } from 'react';
import { login as loginApi, loginWithUsername as loginWithUsernameApi } from '../api/auth.api';
import type { AuthUser, LoginResponse } from '../types/auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<void>;
  // Student Portal foundation (ADR-001) — student-role logins use a
  // username rather than a phone number. Separate method rather than an
  // overload of login() above, so every existing caller of
  // login(phone, password) is unaffected.
  loginWithUsername: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('authUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      try {
        localStorage.removeItem('authUser');
      } catch {
        // Storage unavailable entirely — nothing more we can do here.
      }
      return null;
    }
  });

  // Shared by login() and loginWithUsername() below — both resolve the
  // same LoginResponse shape, just via a different identifier field.
  function applyLoginResponse(data: LoginResponse) {
    const authUser: AuthUser = {
      id: data.user.id,
      schoolId: data.user.schoolId ?? '',
      role: data.user.role,
      fullName: data.user.fullName,
    };
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setUser(authUser);
  }

  async function login(phone: string, password: string) {
    const { data } = await loginApi(phone, password);
    applyLoginResponse(data);
  }

  // Student Portal foundation (ADR-001).
  async function loginWithUsername(username: string, password: string) {
    const { data } = await loginWithUsernameApi(username, password);
    applyLoginResponse(data);
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithUsername, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
