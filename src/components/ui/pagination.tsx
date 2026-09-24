"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonClass } from "@/components/ui/button";

/**
 * Page numbers with an ellipsis. Prev/next render as disabled buttons at the
 * ends rather than dead links, so a keyboard user is never sent to a link
 * that goes nowhere.
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
    <nav aria-label="Pagination" className="flex items-center gap-[4px]">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} scroll={false} aria-label="Previous page" className={buttonClass({ size: "icon" })}>
          <ChevronLeft aria-hidden />
        </Link>
      ) : (
        <button type="button" disabled aria-label="Previous page" className={buttonClass({ size: "icon" })}>
          <ChevronLeft aria-hidden />
        </button>
      )}

      {pageNumbers(page, pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className="px-[4px] text-[12px] text-text-muted">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            scroll={false}
            aria-current={entry === page ? "page" : undefined}
            className={buttonClass({
              active: entry === page,
              className: "min-w-[31px] justify-center",
            })}
          >
            {entry}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} scroll={false} aria-label="Next page" className={buttonClass({ size: "icon" })}>
          <ChevronRight aria-hidden />
        </Link>
      ) : (
        <button type="button" disabled aria-label="Next page" className={buttonClass({ size: "icon" })}>
          <ChevronRight aria-hidden />
        </button>
      )}
    </nav>
  );
}

/** Always shows first, last, and a window around the current page. */
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const window = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => window.add(n));
  if (page >= pageCount - 2)
    [pageCount - 1, pageCount - 2, pageCount - 3].forEach((n) => window.add(n));

  const pages = [...window].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  return pages.flatMap((value, index) =>
    index > 0 && value - pages[index - 1] > 1 ? ["gap" as const, value] : [value],
  );
}
