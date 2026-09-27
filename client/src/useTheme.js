import { useEffect, useState } from 'react';

const THEME_KEY = 'queuesmart_theme';

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// Follows the system theme until the user picks one with the toggle.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  const isDark = theme ? theme === 'dark' : systemPrefersDark();

  function toggle() {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Theme still applies for this visit.
    }
  }

  return { isDark, toggle };
}
