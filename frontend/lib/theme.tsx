"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "night" | "day";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "night",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "day" || stored === "night") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "night" ? "day" : "night";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
