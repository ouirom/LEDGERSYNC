import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface ThemeColors { primary: string; accent: string; }

interface ThemeContextType {
  isDark: boolean;
  toggleDark: () => void;
  setDark: (v: boolean) => void;
  colors: ThemeColors;
  setColors: (c: ThemeColors) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const DEFAULT_COLORS: ThemeColors = { primary: '#0f3460', accent: '#e94560' };

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [colors, setColorsState] = useState<ThemeColors>(DEFAULT_COLORS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--accent', colors.accent);
  }, [colors]);

  const toggleDark = useCallback(() => setIsDark(d => !d), []);
  const setDark = useCallback((v: boolean) => setIsDark(v), []);
  const setColors = useCallback((c: ThemeColors) => setColorsState(c), []);

  const value = useMemo(() => ({ isDark, toggleDark, setDark, colors, setColors }), [isDark, toggleDark, setDark, colors, setColors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
