"use client";

import { useMemo, useSyncExternalStore } from "react";

/*
 * Reads custom-property values back out of the stylesheet, so the design
 * system page prints what the CSS actually resolves to rather than a copy
 * that could drift.
 *
 * A computed custom property has its var() references substituted, so
 * --canvas reads as "#F5F7FB", not "var(--slate-25)". The tokens never change
 * at runtime, so there is nothing to subscribe to: the store exists only to
 * read on the client (the server has no computed styles) without a
 * set-state-in-effect round trip.
 */

const subscribe = () => () => {};

const SEPARATOR = "\u241E";

export function useTokenValues(tokens: readonly string[]) {
  // A joined string is a stable snapshot: useSyncExternalStore compares
  // with Object.is, which a fresh object would fail on every read.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const style = getComputedStyle(document.documentElement);
      return tokens.map((token) => style.getPropertyValue(token).trim()).join(SEPARATOR);
    },
    () => "",
  );

  return useMemo(() => {
    const values = snapshot ? snapshot.split(SEPARATOR) : [];
    return Object.fromEntries(
      tokens.map((token, index) => [token, normaliseHex(values[index] ?? "")]),
    );
  }, [snapshot, tokens]);
}

/**
 * The CSS minifier rewrites colors to their shortest form (#FFFFFF → #fff,
 * rgba → 8-digit hex). Print them the way tokens.css spells them: full-length,
 * uppercase. Anything that is not a hex color passes through untouched.
 */
function normaliseHex(value: string) {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) return value;
  const digits = match[1].length <= 4 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toUpperCase()}`;
}

/** WCAG relative-luminance contrast for two opaque #RRGGBB values; null otherwise. */
export function contrastRatio(foreground: string, background: string): number | null {
  const luminance = (hex: string) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return null;
    const [r, g, b] = [0, 2, 4].map((offset) => {
      const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
