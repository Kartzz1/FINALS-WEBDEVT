import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "rrs-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS = { light: "#f6f3ee", dark: "#0f0e0d" };

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

// Only the words "light" or "dark" are ever stored: a display preference, nothing private.
function savedTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext(null);

// Follows the device setting until the person picks a theme with the toggle.
// index.html applies the saved theme before the page paints, so there is no flash.
export function ThemeProvider({ children }) {
  const [chosen, setChosen] = useState(savedTheme);
  const [system, setSystem] = useState(systemTheme);
  const theme = chosen ?? system;

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event) => setSystem(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setChosen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage. The theme still changes for this visit.
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
