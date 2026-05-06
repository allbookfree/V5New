"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import translations from "@/i18n/translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "ai-prompt-studio-lang";
const COOKIE_KEY = "ai-prompt-studio-lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[-.+*?^$|/\\(){}[\]]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(value);
  document.cookie = `${name}=${v}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function LanguageProvider({ children, initialLang }) {
  // Always start with the value the server rendered with so the first
  // client render matches the SSR HTML and we don't get hydration warnings.
  // After mount we reconcile against localStorage (legacy storage).
  const [lang, setLangState] = useState(initialLang === "bn" ? "bn" : "en");

  // Reconcile with localStorage after hydration (back-compat for users who
  // set their language before cookie support). One-time SSR reconciliation.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if ((stored === "en" || stored === "bn") && stored !== lang) {
        // Deferred to satisfy React 19 set-state-in-effect lint.
        queueMicrotask(() => {
          setLangState(stored);
          writeCookie(COOKIE_KEY, stored);
        });
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLang = useCallback((newLang) => {
    const validLang = newLang === "bn" ? "bn" : "en";
    setLangState(validLang);
    try {
      localStorage.setItem(STORAGE_KEY, validLang);
    } catch {};
    writeCookie(COOKIE_KEY, validLang);
  }, []);

  const t = useCallback((path) => {
    const keys = path.split(".");
    let val = translations[lang];
    for (const k of keys) {
      if (val && typeof val === "object" && k in val) {
        val = val[k];
      } else {
        let fallback = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === "object" && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return path;
          }
        }
        return typeof fallback === "string" ? fallback : path;
      }
    }
    return typeof val === "string" ? val : path;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
