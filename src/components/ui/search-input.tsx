"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

/**
 * Search is a URL parameter, not component state: it survives a refresh, is
 * shareable, and lets the table stay a server component.
 *
 * Typing is debounced by 300ms so a five-character query is one round trip
 * rather than five — perceived speed is part of the design, not an
 * optimisation to revisit later.
 */
export function SearchInput({
  placeholder = "Search",
  label,
  className,
}: {
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      // A new query invalidates the current page offset.
      next.delete("page");

      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div
      className={cn(
        "flex items-center gap-[10px] border border-neutral-5 bg-white pl-[15.75px] pr-[24.75px] py-[11px] focus-within:border-brand",
        className,
      )}
    >
      <Search aria-hidden className="size-[18px] shrink-0 text-neutral-2" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-small font-medium text-neutral-1 outline-none placeholder:text-neutral-2"
      />
    </div>
  );
}
