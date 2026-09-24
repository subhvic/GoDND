"use client";

import { useEffect, useLayoutEffect } from "react";

import { applyTheme } from "@/lib/theme";

import { useTheme } from "./use-theme";

/**
 * Keeps <html data-theme> correct after hydration.
 *
 * The inline bootstrap script sets the attribute before first paint, which is
 * all a production build needs. In development, Strict Mode remounts the tree
 * and React resets <html> to the attributes it owns, clearing the one the
 * script set — so the page would silently fall back to the default theme.
 * Re-applying in a layout effect restores it before paint. (Next 16 docs,
 * "Preventing flash before hydration".)
 */
export function ThemeController() {
  const { theme } = useTheme();

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // While on auto, follow the OS as it changes.
  useEffect(() => {
    if (theme !== "auto" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("auto");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
