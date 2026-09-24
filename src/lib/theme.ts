/**
 * Theme control for the whole platform.
 *
 * A single attribute — document.documentElement[data-theme] — selects the
 * active theme; tokens.css re-points its semantic and component tokens under
 * :root[data-theme="light"]. The preference is one of light | dark | auto,
 * persisted to localStorage; auto follows the OS.
 *
 * Default is dark, matching the reference system, so a first visit never
 * flashes the wrong way. The attribute is set by an inline script in the root
 * layout before first paint (THEME_BOOTSTRAP), and this module keeps React's
 * view of the preference in step with it.
 */

export const THEME_KEY = "godnd-theme";
export const THEME_OPTIONS = ["light", "dark", "auto"] as const;
export type ThemePreference = (typeof THEME_OPTIONS)[number];
export type ResolvedTheme = "light" | "dark";

const DEFAULT: ThemePreference = "dark";

function isPreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.includes(value as ThemePreference);
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isPreference(stored) ? stored : DEFAULT;
  } catch {
    // Private mode or blocked storage — fall back to the default.
    return DEFAULT;
  }
}

function prefersLight() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  );
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "auto") return prefersLight() ? "light" : "dark";
  return preference;
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(preference);
}

/**
 * Runs synchronously while the browser parses <head>, before any content is
 * painted. Kept as a plain string because it executes before React exists;
 * the logic must stay identical to resolveTheme above.
 */
export const THEME_BOOTSTRAP = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");if(p!=="light"&&p!=="dark"&&p!=="auto")p="${DEFAULT}";var t=p==="auto"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/* ---------------------------------------------------------------------------
 * A tiny external store, so every theme control on the page (the account
 * menu, the design-system toggle) reads one preference and updates together.
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let preference: ThemePreference | null = null;

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemeSnapshot(): ThemePreference {
  if (preference === null) preference = readStoredPreference();
  return preference;
}

export function getServerThemeSnapshot(): ThemePreference {
  return DEFAULT;
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Still applied for this session.
  }
  applyTheme(next);
  listeners.forEach((listener) => listener());
}
