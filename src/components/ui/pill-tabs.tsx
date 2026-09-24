"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Pill tab bar — one pattern, reused everywhere (source: TabBar).
 *
 * Two modes. Link tabs, for tabs that are server state (a list filter): each
 * one is a real URL, so it survives a refresh and opens in a new tab. Button
 * tabs, for tabs that are purely local view state.
 */
export type PillTab = { id: string; label: string; count?: number; href?: string };

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
  return (
    <nav aria-label={label} className={cn("pill-tabs", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const content = (
          <>
            {tab.label}
            {tab.count != null ? <span className="count">{tab.count}</span> : null}
          </>
        );

        return tab.href ? (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn("pill-tab", isActive && "active")}
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
