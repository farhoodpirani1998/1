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
  // Sprint P1 — Universal Avatar System. Lets a caller (useUploadAvatar/
  // useDeleteAvatar) patch the signed-in user's own session state after
  // an avatar mutation, without a full re-login. Merges into the
  // existing user rather than replacing it, so callers only need to
  // pass the field(s) that changed (today, just avatarUrl).
  updateUser: (patch: Partial<AuthUser>) => void;
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
      // Sprint P1 — Universal Avatar System. Backend's login response
      // already includes this on `user` (see AuthService.login's
      // safeUser spread); ?? null covers a user who hasn't uploaded one.
      avatarUrl: data.user.avatarUrl ?? null,
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

  // Sprint P1 — Universal Avatar System. Used by useUploadAvatar/
  // useDeleteAvatar after a successful mutation, so the new/cleared
  // avatarUrl shows up immediately in Topbar/Sidebar without requiring
  // a re-login. No-ops if called with no user signed in (shouldn't
  // happen in practice, since these mutations are only ever triggered
  // from an authenticated screen).
  function updateUser(patch: Partial<AuthUser>) {
    setUser((current) => {
      if (!current) {
        return current;
      }
      const updated = { ...current, ...patch };
      localStorage.setItem('authUser', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithUsername, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
