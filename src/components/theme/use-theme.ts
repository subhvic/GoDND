"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  resolveTheme,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

/** React's view of the theme preference. */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const toggle = useCallback(() => {
    setThemePreference(resolveTheme(theme) === "light" ? "dark" : "light");
  }, [theme]);

  return {
    theme,
    resolved: resolveTheme(theme),
    setTheme: (next: ThemePreference) => setThemePreference(next),
    toggle,
  };
}
