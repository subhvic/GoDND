"use client";

import Link from "next/link";
import { DropdownMenu as Menu } from "radix-ui";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flag,
  Inbox,
  SearchX,
  Users,
} from "lucide-react";

import { useInbox } from "@/components/enquiries/inbox-provider";
import { useInboxQuery, type WhoFilter } from "@/components/enquiries/use-inbox-query";
import { buttonClass } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSection,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PillTabs } from "@/components/ui/pill-tabs";
import {
  formatGuestCount,
  formatListTime,
  formatWaiting,
  formatWaitingLong,
  initials,
  minutesSince,
} from "@/lib/enquiries/format";
import {
  countByView,
  matchesSearch,
  previewText,
  sortForView,
  viewForEnquiry,
} from "@/lib/enquiries/views";
import { REPLY_OVERDUE_MINUTES, statusForEnquiry, statusForWaiting } from "@/lib/status";
import {
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_VIEWS,
  type EnquiryRow,
  type EnquiryViewKey,
  type TeamMember,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const WHO_LABELS: Record<WhoFilter, string> = {
  all: "Everyone",
  mine: "Assigned to me",
  unassigned: "Unassigned",
};

const VIEW_LABELS = Object.fromEntries(ENQUIRY_VIEWS.map((entry) => [entry.key, entry.label])) as Record<
  EnquiryViewKey,
  string
>;

/**
 * The conversation list — the left pane on a wide screen, the whole screen on
 * a phone. Split into three views by whose move it is (see ENQUIRY_VIEWS),
 * searchable across everything, and filterable by owner for teams.
 */
export function EnquiryList() {
  const { rows, now, you, selectedId } = useInbox();
  const { view, q, who, update, queryString, pathname } = useInboxQuery();
  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A search typed just before leaving the page must not rewrite the next
  // page's URL.
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const onSearch = (value: string) => {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value }), 250);
  };

  const scoped = useMemo(
    () =>
      rows.filter((row) => {
        if (who === "mine" && row.assignee?.id !== you?.id) return false;
        if (who === "unassigned" && row.assignee) return false;
        return matchesSearch(row, search);
      }),
    [rows, who, you, search],
  );

  const counts = useMemo(() => countByView(scoped), [scoped]);
  const overdue = useMemo(
    () =>
      scoped.filter(
        (row) =>
          viewForEnquiry(row) === "needs_reply" &&
          row.awaitingReplySince &&
          minutesSince(row.awaitingReplySince, now) >= REPLY_OVERDUE_MINUTES,
      ).length,
    [scoped, now],
  );

  /*
   * Sticky selection. Replying to a conversation in "Needs reply" moves it to
   * "Replied" — correct, but if the row vanished from under the operator the
   * list would jump and they would lose their place. The open conversation
   * stays where it was, marked as moved, until they open another.
   */
  const [sticky, setSticky] = useState<{ id: string; view: EnquiryViewKey; key: number } | null>(null);
  const [stickyFor, setStickyFor] = useState<{ selectedId: string | null; view: EnquiryViewKey } | null>(null);
  if (!stickyFor || stickyFor.selectedId !== selectedId || stickyFor.view !== view) {
    setStickyFor({ selectedId, view });
    const selected = rows.find((row) => row.id === selectedId);
    setSticky(
      selected && viewForEnquiry(selected) === view
        ? { id: selected.id, view, key: sortKey(selected, view) }
        : null,
    );
  }

  const visible = useMemo(() => {
    const inView = scoped.filter((row) => viewForEnquiry(row) === view);
    const stickyRow =
      sticky && sticky.view === view && !inView.some((row) => row.id === sticky.id)
        ? scoped.find((row) => row.id === sticky.id)
        : undefined;
    const list = stickyRow ? [...inView, stickyRow] : inView;
    return sortForView(list, view, sticky ? { [sticky.id]: sticky.key } : undefined);
  }, [scoped, view, sticky]);

  const listRef = useRef<HTMLUListElement>(null);
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("[data-conv-link]") ?? []);
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowDown"
            ? Math.min(index + 1, links.length - 1)
            : Math.max(index - 1, 0);
    event.preventDefault();
    links[next]?.focus();
  };

  const viewHref = (key: EnquiryViewKey) => {
    const next = new URLSearchParams(queryString.replace(/^\?/, ""));
    if (key === "needs_reply") next.delete("view");
    else next.set("view", key);
    const search = next.toString();
    return `${pathname}${search ? `?${search}` : ""}`;
  };

  const otherMatches = ENQUIRY_VIEWS.filter((entry) => entry.key !== view && counts[entry.key] > 0);

  return (
    <aside className="inbox-list" aria-label="Enquiries">
      <div className="inbox-list-head">
        <PillTabs
          label="Enquiry views"
          className="inbox-views"
          active={view}
          onChange={(id) => update({ view: id as EnquiryViewKey })}
          tabs={ENQUIRY_VIEWS.map((entry) => ({
            id: entry.key,
            label: entry.label,
            href: viewHref(entry.key),
            count: counts[entry.key],
            countTone: entry.key === "needs_reply" && overdue > 0 ? "critical" : undefined,
            countLabel: entry.key === "needs_reply" && overdue > 0 ? `${overdue} overdue` : undefined,
          }))}
        />

        <div className="inbox-filter-row">
          <div className="search-wrap inbox-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              className="search-input"
              aria-label="Search enquiries"
              placeholder="Search enquiries"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) {
                  event.preventDefault();
                  onSearch("");
                }
              }}
            />
          </div>
          <WhoMenu who={who} onChange={(next) => update({ who: next })} you={you} />
        </div>
      </div>

      <nav className="inbox-list-scroll" aria-label={`${VIEW_LABELS[view]} conversations`}>
        {visible.length === 0 ? (
          <ListEmpty
            view={view}
            search={search}
            who={who}
            otherMatches={otherMatches.map((entry) => ({
              key: entry.key,
              label: entry.label,
              count: counts[entry.key],
            }))}
            onShow={(key) => update({ view: key })}
            onClear={() => {
              onSearch("");
              update({ who: "all" });
            }}
          />
        ) : (
          <ul ref={listRef} role="list" className="conv-list" onKeyDown={onListKeyDown}>
            {visible.map((row) => (
              <ConversationItem
                key={row.id}
                row={row}
                view={view}
                selected={row.id === selectedId}
                now={now}
                youId={you?.id ?? null}
                href={`/dashboard/enquiries/${encodeURIComponent(row.id)}${queryString}`}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

/** The value a row is ordered by in a view — frozen for the sticky row. */
function sortKey(row: EnquiryRow, view: EnquiryViewKey): number {
  if (view === "needs_reply") return Date.parse(row.awaitingReplySince ?? row.createdAt);
  return Date.parse(row.lastMessageAt ?? row.createdAt);
}

/* ------------------------------------------------------------------------ */

const ConversationItem = memo(function ConversationItem({
  row,
  view,
  selected,
  now,
  youId,
  href,
}: {
  row: EnquiryRow;
  view: EnquiryViewKey;
  selected: boolean;
  now: Date;
  youId: string | null;
  href: string;
}) {
  const rowView = viewForEnquiry(row);
  const moved = rowView !== view;
  const unread = row.unreadCount > 0;
  const stage = statusForEnquiry(row.status);

  let time: React.ReactNode;
  if (moved) {
    time = <span className="conv-moved">Moved to {VIEW_LABELS[rowView]}</span>;
  } else if (view === "needs_reply" && row.awaitingReplySince) {
    const minutes = minutesSince(row.awaitingReplySince, now);
    const tone = statusForWaiting(minutes);
    time = (
      <span className={cn("conv-wait", tone)} title={`Waiting ${formatWaitingLong(minutes)} for a reply`}>
        <Clock aria-hidden />
        <span aria-hidden>{formatWaiting(minutes)}</span>
        <span className="sr-only">, waiting {formatWaitingLong(minutes)}</span>
      </span>
    );
  } else {
    time = <span className="conv-time">{formatListTime(row.lastMessageAt ?? row.createdAt, now)}</span>;
  }

  return (
    <li>
      <Link
        href={href}
        scroll={false}
        data-conv-link
        aria-current={selected ? "page" : undefined}
        className={cn("conv-item", selected && "selected", unread && "unread")}
      >
        <span className="conv-avatar" aria-hidden>
          {initials(row.contactName)}
        </span>
        <span className="conv-body">
          <span className="conv-line">
            <span className="conv-name">{row.contactName}</span>
            {row.priority === "high" ? (
              <Flag className="conv-flag" aria-label="High priority" role="img" />
            ) : null}
            {time}
          </span>
          <span className="conv-line conv-meta">
            <span className={cn("stage-dot", stage)} aria-hidden />
            <span className="shrink-0">{ENQUIRY_STATUS_LABELS[row.status]}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{row.experienceTitle ?? "General enquiry"}</span>
            <span aria-hidden className="shrink-0">·</span>
            <span className="shrink-0">{formatGuestCount(row.adults, row.children, row.infants)}</span>
          </span>
          <span className="conv-line">
            <span className="conv-preview">{previewText(row, youId)}</span>
            {unread ? (
              <span className="conv-unread">
                {row.unreadCount}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
});

/* ------------------------------------------------------------------------ */

function WhoMenu({
  who,
  onChange,
  you,
}: {
  who: WhoFilter;
  onChange: (who: WhoFilter) => void;
  you: TeamMember | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonClass({ active: who !== "all", className: "inbox-who" })}
        aria-label={`Owner filter: ${WHO_LABELS[who]}`}
      >
        <Users aria-hidden />
        <span className="inbox-who-label">{who === "mine" ? "Mine" : WHO_LABELS[who]}</span>
        <ChevronDown aria-hidden className="inbox-who-caret" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] min-w-0">
        <DropdownMenuSection label="Show conversations">
          <Menu.RadioGroup value={who} onValueChange={(value) => onChange(value as WhoFilter)}>
            {(Object.keys(WHO_LABELS) as WhoFilter[]).map((key) => (
              <Menu.RadioItem
                key={key}
                value={key}
                disabled={key === "mine" && !you}
                className="pop-item outline-none data-[highlighted]:bg-panel data-[highlighted]:text-text-primary data-[disabled]:opacity-40"
              >
                {WHO_LABELS[key]}
                <Menu.ItemIndicator>
                  <Check aria-hidden className="size-[14px] text-brand" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </DropdownMenuSection>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListEmpty({
  view,
  search,
  who,
  otherMatches,
  onShow,
  onClear,
}: {
  view: EnquiryViewKey;
  search: string;
  who: WhoFilter;
  otherMatches: { key: EnquiryViewKey; label: string; count: number }[];
  onShow: (view: EnquiryViewKey) => void;
  onClear: () => void;
}) {
  const filtered = Boolean(search.trim()) || who !== "all";

  if (filtered) {
    return (
      <div className="inbox-empty" role="status">
        <span className="inbox-empty-icon">
          <SearchX aria-hidden />
        </span>
        <p className="inbox-empty-title">
          {search.trim() ? `Nothing in ${VIEW_LABELS[view]} matches “${search.trim()}”` : `Nothing in ${VIEW_LABELS[view]} for this filter`}
        </p>
        {otherMatches.length > 0 ? (
          <div className="inbox-empty-actions">
            {otherMatches.map((match) => (
              <button key={match.key} type="button" className={buttonClass({ size: "small" })} onClick={() => onShow(match.key)}>
                {match.count} in {match.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="inbox-empty-desc">Try a name, phone number, trip or ENQ reference.</p>
        )}
        <button type="button" className="inbox-empty-link" onClick={onClear}>
          Clear search and filters
        </button>
      </div>
    );
  }

  if (view === "needs_reply") {
    return (
      <div className="inbox-empty" role="status">
        <span className="inbox-empty-icon healthy">
          <CheckCircle2 aria-hidden />
        </span>
        <p className="inbox-empty-title">You&rsquo;re all caught up</p>
        <p className="inbox-empty-desc">
          Nobody is waiting on a reply. New enquiries from your website and the
          marketplace land here first.
        </p>
      </div>
    );
  }

  return (
    <div className="inbox-empty" role="status">
      <span className="inbox-empty-icon">
        <Inbox aria-hidden />
      </span>
      <p className="inbox-empty-title">
        {view === "replied" ? "No conversations waiting on travellers" : "Nothing closed yet"}
      </p>
      <p className="inbox-empty-desc">
        {view === "replied"
          ? "Once you reply, a conversation moves here until the traveller answers."
          : "Won, lost and spam enquiries are kept here for 90 days."}
      </p>
    </div>
  );
}
