"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ENQUIRY_VIEWS, type EnquiryViewKey } from "@/lib/types";

export type WhoFilter = "all" | "mine" | "unassigned";

/**
 * The list's view, search and owner filter, kept in the URL so a refresh or
 * a shared link lands on the same slice of the inbox.
 *
 * Updates go through history.replaceState, which Next's router observes, so
 * useSearchParams re-renders the list without a server round trip: filtering
 * a list the browser already holds should cost a frame, not a request.
 */
export function useInboxQuery() {
  const params = useSearchParams();
  const pathname = usePathname();

  const view = parseView(params.get("view"));
  const q = params.get("q") ?? "";
  const who = parseWho(params.get("who"));

  const update = useCallback(
    (patch: Partial<{ view: EnquiryViewKey; q: string; who: WhoFilter }>) => {
      const next = new URLSearchParams(window.location.search);
      if (patch.view !== undefined) {
        if (patch.view === "needs_reply") next.delete("view");
        else next.set("view", patch.view);
      }
      if (patch.q !== undefined) {
        if (patch.q.trim()) next.set("q", patch.q.trim());
        else next.delete("q");
      }
      if (patch.who !== undefined) {
        if (patch.who === "all") next.delete("who");
        else next.set("who", patch.who);
      }
      const search = next.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    },
    [],
  );

  /** "?view=replied&q=meghalaya" — carried onto every conversation link. */
  const queryString = useMemo(() => {
    const search = params.toString();
    return search ? `?${search}` : "";
  }, [params]);

  return { view, q, who, update, queryString, pathname };
}

function parseView(value: string | null): EnquiryViewKey {
  return ENQUIRY_VIEWS.some((entry) => entry.key === value)
    ? (value as EnquiryViewKey)
    : "needs_reply";
}

function parseWho(value: string | null): WhoFilter {
  return value === "mine" || value === "unassigned" ? value : "all";
}
