"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

/**
 * Search field (source: .search-wrap / .search-input).
 *
 * The query is a URL parameter, not component state: it survives a refresh,
 * is shareable, and lets the list stay a server component. Typing is
 * debounced by 300ms so a five-character query is one round trip, not five.
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
    <div className={cn("search-wrap", className)}>
      <Search aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
    </div>
  );
}
