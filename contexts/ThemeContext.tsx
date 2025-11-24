
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('eburon_theme');
    return (storedTheme as Theme) || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    if (theme === 'light') {
      root.classList.add('light-mode');
      body.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
      body.classList.remove('light-mode');
    }
    
    localStorage.setItem('eburon_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
