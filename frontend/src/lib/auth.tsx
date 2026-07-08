import { createContext, useContext, useState, ReactNode } from 'react';
import { login as loginApi } from '../api/auth.api';
import type { AuthUser } from '../types/auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('authUser');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(phone: string, password: string) {
    const { data } = await loginApi(phone, password);
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

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
