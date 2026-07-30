import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useTheme } from './ThemeContext';
import type { Theme } from '../types/api';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  tenantId: number;
  tenantCode?: string;
  entrepriseId?: number;
  entrepriseNom?: string;
  mustChangePassword?: boolean;
}

// Forme renvoyée par GET /auth/me (plus riche que le User stocké en contexte,
// utilisée seulement pour extraire le thème de l'entreprise/tenant à la connexion)
interface MeResponseUser {
  must_change_password?: boolean;
  entreprise?: { theme?: Theme | null } | null;
  tenant?: { theme?: Theme | null } | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: string[]) => boolean;
  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setColors } = useTheme();

  // Injection dynamique des couleurs de l'entreprise (fallback: thème du tenant)
  const applyEntrepriseTheme = useCallback((rawUser: MeResponseUser) => {
    const theme = rawUser?.entreprise?.theme || rawUser?.tenant?.theme;
    if (theme) {
      setColors({ primary: theme.couleur_primaire, accent: theme.couleur_accent });
    }
  }, [setColors]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => {
          setUser({ ...data.user, mustChangePassword: data.user.must_change_password });
          applyEntrepriseTheme(data.user);
        })
        .catch(() => { localStorage.clear(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [applyEntrepriseTheme]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    api.get('/auth/me').then(({ data: me }) => applyEntrepriseTheme(me.user)).catch(() => {});
  }, [applyEntrepriseTheme]);

  const logout = useCallback(() => {
    api.post('/auth/logout').finally(() => {
      localStorage.clear();
      setUser(null);
      window.location.href = '/login';
    });
  }, []);

  const hasRole = useCallback((...roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  }, [user]);

  const markPasswordChanged = useCallback(() => {
    setUser(u => u ? { ...u, mustChangePassword: false } : u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, hasRole, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
