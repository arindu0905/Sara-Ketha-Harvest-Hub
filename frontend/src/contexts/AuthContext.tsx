import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../services/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  account_status: string;
  avatar_url?: string;
  assigned_centre?: string;
  entity?: Record<string, unknown>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; role?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('hh_access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await authApi.getMe();
      setUser(data.data);
    } catch {
      // Token invalid or expired
      localStorage.removeItem('hh_access_token');
      localStorage.removeItem('hh_refresh_token');
      localStorage.removeItem('hh_user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    const { access_token, refresh_token, user: userData } = data.data;

    localStorage.setItem('hh_access_token', access_token);
    localStorage.setItem('hh_refresh_token', refresh_token);
    localStorage.setItem('hh_user', JSON.stringify(userData));

    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('hh_access_token');
      localStorage.removeItem('hh_refresh_token');
      localStorage.removeItem('hh_user');
      setUser(null);
    }
  };

  const register = async (regData: { email: string; password: string; full_name: string; role?: string }) => {
    await authApi.register(regData);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
