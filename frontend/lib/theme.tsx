"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme =
  | "midnight"
  | "day"
  | "ocean"
  | "forest"
  | "rose"
  | "slate"
  | "amber"
  | "violet"
  | "dusk"
  | "nordic";

export const THEMES: { id: Theme; label: string; base: string; surface: string; primary: string; description: string }[] = [
  { id: "midnight", label: "Midnight",  base: "#080c14", surface: "#0f1623", primary: "#6366f1", description: "Classic deep dark" },
  { id: "day",      label: "Day",       base: "#f0f4f8", surface: "#ffffff", primary: "#6366f1", description: "Clean light mode" },
  { id: "ocean",    label: "Ocean",     base: "#07111f", surface: "#0d1f33", primary: "#0ea5e9", description: "Deep blue-teal" },
  { id: "forest",   label: "Forest",    base: "#061209", surface: "#0c1f10", primary: "#22c55e", description: "Dark green tones" },
  { id: "rose",     label: "Rose",      base: "#120810", surface: "#1e0f1a", primary: "#f43f5e", description: "Warm pink accent" },
  { id: "slate",    label: "Slate",     base: "#0a0d12", surface: "#131720", primary: "#94a3b8", description: "Cool neutral dark" },
  { id: "amber",    label: "Amber",     base: "#130d04", surface: "#1f1507", primary: "#f59e0b", description: "Warm gold tones" },
  { id: "violet",   label: "Violet",    base: "#0d0814", surface: "#160e21", primary: "#8b5cf6", description: "Deep purple" },
  { id: "dusk",     label: "Dusk",      base: "#110e08", surface: "#1c180f", primary: "#d4935a", description: "Warm sepia" },
  { id: "nordic",   label: "Nordic",    base: "#0e1217", surface: "#161c25", primary: "#64a0c8", description: "Muted blue-grey" },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "midnight",
  setTheme: () => {},
});

const VALID_THEMES = new Set<string>(THEMES.map((t) => t.id));

function isValidTheme(v: string | null): v is Theme {
  return v !== null && VALID_THEMES.has(v);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("midnight");

  useEffect(() => {
    const raw = localStorage.getItem("theme");
    // backwards compat: "night" → "midnight"
    const stored = raw === "night" ? "midnight" : raw;
    if (isValidTheme(stored)) {
      setThemeState(stored);
      applyTheme(stored);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
