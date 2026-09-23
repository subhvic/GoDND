"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page numbers with an ellipsis, as drawn in the handoff file (1 2 3 4 6 … 22).
 * Prev/next are rendered as disabled spans at the ends rather than dead links,
 * so keyboard users aren't sent to a link that does nothing.
 */
export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(params);
    if (target === 1) next.delete("page");
    else next.set("page", String(target));
    return `${pathname}?${next.toString()}`;
  };

  return (
    <nav aria-label="Pagination" className="flex items-center gap-[6px]">
      <Step
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        label="Previous page"
        icon={<ChevronLeft aria-hidden className="size-[16px]" />}
      />

      {pageNumbers(page, pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden
            className="px-[6px] text-small text-neutral-2"
          >
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            scroll={false}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex h-[28px] min-w-[28px] items-center justify-center border px-[8px] text-small transition-colors",
              entry === page
                ? "border-brand bg-brand font-bold text-white"
                : "border-neutral-4 bg-white text-neutral-1 hover:bg-surface-sunken",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <Step
        href={hrefFor(page + 1)}
        disabled={page >= pageCount}
        label="Next page"
        icon={<ChevronRight aria-hidden className="size-[16px]" />}
      />
    </nav>
  );
}

function Step({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="flex size-[28px] items-center justify-center text-neutral-3"
      >
        {icon}
        <span className="sr-only-focusable">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="flex size-[28px] items-center justify-center text-neutral-1 hover:bg-surface-sunken"
    >
      {icon}
    </Link>
  );
}

/** Always shows first, last, and a window around the current page. */
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const window = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => window.add(n));
  if (page >= pageCount - 2)
    [pageCount - 1, pageCount - 2, pageCount - 3].forEach((n) => window.add(n));

  const pages = [...window]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  return pages.flatMap((value, index) =>
    index > 0 && value - pages[index - 1] > 1 ? ["gap" as const, value] : [value],
  );
}
