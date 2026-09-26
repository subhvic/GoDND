"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Pill tab bar — one pattern, reused everywhere (source: TabBar).
 *
 * Two modes. Link tabs, for tabs that are server state (a list filter): each
 * one is a real URL, so it survives a refresh and opens in a new tab. Button
 * tabs, for tabs that are purely local view state. Given both an href and
 * onChange, a tab is a link that upgrades to local state once hydrated —
 * for URL state the client can apply without a round trip.
 */
export type PillTab = {
  id: string;
  label: string;
  count?: number;
  /** Colors the count when it needs attention, e.g. overdue replies. */
  countTone?: "critical" | "warning";
  /** Spoken after the count, e.g. "2 overdue". */
  countLabel?: string;
  href?: string;
  icon?: React.ReactNode;
};

export function PillTabs({
  tabs,
  active,
  onChange,
  label,
  className,
}: {
  tabs: PillTab[];
  active: string;
  onChange?: (id: string) => void;
  /** Names the group for assistive tech, e.g. "Experience status". */
  label: string;
  className?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const settled = useRef(false);

  // On a phone the bar scrolls sideways; keep the active tab in view —
  // landing on ?tab=cancelled shouldn't leave it off the edge. Scrolls only
  // the bar (never the page), instantly on load and smoothly after.
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>(".pill-tab.active");
    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) return;
    const left = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    const visible = left >= nav.scrollLeft && left + tab.offsetWidth <= nav.scrollLeft + nav.clientWidth;
    if (!visible) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nav.scrollTo({
        left: left - (nav.clientWidth - tab.offsetWidth) / 2,
        behavior: settled.current && !reduce ? "smooth" : "auto",
      });
    }
    settled.current = true;
  }, [active]);

  return (
    <nav ref={navRef} aria-label={label} className={cn("pill-tabs", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const content = (
          <>
            {tab.icon ?? null}
            {tab.label}
            {tab.count != null ? (
              <span className={cn("count", tab.countTone)}>
                {tab.count}
                {tab.countLabel ? <span className="sr-only"> ({tab.countLabel})</span> : null}
              </span>
            ) : null}
          </>
        );

        return tab.href ? (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn("pill-tab", isActive && "active")}
            onClick={
              onChange
                ? (event) => {
                    // Both given: a real link until the page hydrates (and
                    // for open-in-new-tab), local state after that.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                    event.preventDefault();
                    onChange(tab.id);
                  }
                : undefined
            }
          >
            {content}
          </Link>
        ) : (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(tab.id)}
            className={cn("pill-tab", isActive && "active")}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
