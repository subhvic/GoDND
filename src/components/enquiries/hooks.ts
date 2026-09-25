"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/*
 * Small browser hooks for the inbox. Each reads an external source through
 * useSyncExternalStore with an explicit server snapshot, so the first client
 * render matches the server's markup and the real value swaps in after
 * hydration — no mismatch warnings, no effect-driven double render.
 */

/** Matches a media query; false on the server. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* --- localStorage-backed values ----------------------------------------- */

const storageListeners = new Set<() => void>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage: behave as if nothing was saved.
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Quota or privacy settings — the value just won't outlive the tab.
  }
  storageListeners.forEach((listener) => listener());
}

function subscribeStorage(listener: () => void) {
  storageListeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    storageListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** A remembered on/off preference, e.g. whether the details panel is docked. */
export function usePersistentBoolean(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => null,
  );
  const value = stored === null ? fallback : stored === "1";
  const set = useCallback((next: boolean) => writeStorage(key, next ? "1" : "0"), [key]);
  return [value, set];
}

/**
 * A per-conversation draft. Kept in localStorage so a half-written reply
 * survives switching threads, a refresh, or the phone killing the tab —
 * design rule 05: never a lost draft.
 */
export function useDraft(key: string): [string, (next: string) => void] {
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => null,
  );
  // What the operator typed wins over storage. If storage is blocked
  // (private mode), the input must still take keystrokes — it just won't
  // survive a reload.
  const [local, setLocal] = useState<{ key: string; value: string } | null>(null);
  const value = local && local.key === key ? local.value : (stored ?? "");
  const set = useCallback(
    (next: string) => {
      setLocal({ key, value: next });
      writeStorage(key, next ? next : null);
    },
    [key],
  );
  return [value, set];
}

/**
 * Pins a full-screen element to the visual viewport while it is mounted.
 *
 * On iOS Safari the on-screen keyboard shrinks the visual viewport but not
 * the layout viewport, so a `position: fixed; bottom: 0` composer ends up
 * hidden behind the keyboard. Exposing the visual viewport's height and
 * offset as CSS variables lets the mobile thread size itself to the space
 * that is actually visible. Android Chrome resizes the layout viewport
 * itself (interactive-widget=resizes-content), and there this is a no-op.
 */
export function useVisualViewportVars(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;

    const update = () => {
      root.style.setProperty("--vv-height", `${viewport.height}px`);
      root.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-top");
    };
  }, [enabled]);
}

/** Online/offline, for the banner that explains why a send is failing. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
