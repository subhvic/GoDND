"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import { EXPERIENCE_TABS, type ExperienceTabKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The five status tabs. Rendered as links rather than buttons so each tab is a
 * real, shareable URL and works with a middle click — the state is server
 * state, and pretending otherwise would mean re-fetching on the client for no
 * gain.
 */
export function ExperienceTabs({
  active,
  counts,
}: {
  active: ExperienceTabKey;
  counts: Record<ExperienceTabKey, number>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (tab: ExperienceTabKey) => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    next.delete("page");
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-[4px] border-b border-neutral-4 px-[16px] sm:flex-row sm:items-center sm:justify-between sm:gap-[16px] lg:px-[32px]">
      <div
        role="tablist"
        aria-label="Experience status"
        className="flex min-w-0 flex-1 gap-[18px] overflow-x-auto lg:gap-[30px]"
      >
        {EXPERIENCE_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={hrefFor(tab.key)}
              role="tab"
              aria-selected={isActive}
              scroll={false}
              className={cn(
                "flex flex-col items-center whitespace-nowrap px-[4px] pb-[8px] text-small transition-colors",
                isActive
                  ? "border-b-2 border-neutral-1 font-bold text-neutral-1"
                  : "border-b-2 border-transparent font-medium text-neutral-2 hover:text-neutral-1",
              )}
            >
              {tab.label} ({counts[tab.key] ?? 0})
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        className="flex shrink-0 items-center gap-[5px] self-end px-[4px] pb-[8px] text-small font-medium text-neutral-1 hover:text-brand sm:self-auto"
      >
        <SlidersHorizontal aria-hidden className="size-[12px]" />
        Filters
      </button>
    </div>
  );
}
