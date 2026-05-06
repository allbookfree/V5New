"use client";

import { useState, useEffect } from "react";
import { ApiKeyProvider } from "@/context/ApiKeyContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Menu } from "lucide-react";

function LayoutInner({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t, lang } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="main">
        <button type="button" className="mobile-btn" onClick={() => setSidebarOpen(true)} aria-label={t("nav.openMenu")}>
          <Menu size={20} />
        </button>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function ClientLayout({ children, initialLang, initialTheme }) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <LanguageProvider initialLang={initialLang}>
        <ApiKeyProvider>
          <LayoutInner>{children}</LayoutInner>
        </ApiKeyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
