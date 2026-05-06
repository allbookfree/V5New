"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const ThemeContext = createContext(null);
const THEME_KEY = "ai-prompt-studio-theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeThemeCookie(value) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_KEY}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function ThemeProvider({ children, initialTheme }) {
  // initialTheme comes from the server (cookie). We always render with the
  // server-provided value first so the SSR HTML matches the first client
  // render. After hydration we sync to localStorage (legacy storage) and
  // honour any user preference there.
  const [theme, setTheme] = useState(initialTheme === "dark" ? "dark" : "light");
  const mountedRef = useRef(false);

  // After hydration: prefer localStorage if it disagrees with the cookie
  // (back-compat for users who set the theme before we added cookies). This is
  // an intentional one-time SSR-state reconciliation, hence the lint disable.
  useEffect(() => {
    mountedRef.current = true;
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if ((stored === "dark" || stored === "light") && stored !== theme) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
        writeThemeCookie(stored);
      }
    } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mountedRef.current) {
      document.documentElement.setAttribute("data-theme", theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch {}
      writeThemeCookie(theme);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
