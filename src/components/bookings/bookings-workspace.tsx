"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Ban, CalendarClock, CheckCircle2, CreditCard, Navigation } from "lucide-react";

import { fetchBookingDetail } from "@/app/dashboard/bookings/actions";
import { BookingDrawer } from "@/components/bookings/booking-drawer";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { PageBar } from "@/components/ui/page-bar";
import { Pagination } from "@/components/ui/pagination";
import { PillTabs } from "@/components/ui/pill-tabs";
import { balanceMinor, lastDay, needsWrapUp, phaseForBooking } from "@/lib/bookings/phase";
import { dayKey } from "@/lib/time";
import { BOOKING_TABS, type BookingDetail, type BookingRow, type BookingTabKey } from "@/lib/types";

const TAB_ICONS: Record<BookingTabKey, React.ReactNode> = {
  awaiting: <CreditCard size={13} aria-hidden />,
  upcoming: <CalendarClock size={13} aria-hidden />,
  ongoing: <Navigation size={13} aria-hidden />,
  completed: <CheckCircle2 size={13} aria-hidden />,
  cancelled: <Ban size={13} aria-hidden />,
};

const PAGE_SIZE = 10;

/**
 * The Bookings list and its drawer, held in the browser.
 *
 * Every booking is loaded once; the tabs, search and pages are applied here.
 * That is what lets an action in the drawer move a booking between phases in
 * the same frame — record the payment on an unpaid booking and it leaves
 * Awaiting payment for Upcoming without a reload — and it is also what keeps
 * Ongoing honest: the phase is worked out from today's date on every render,
 * not stored.
 */
export function BookingsWorkspace({
  rows: serverRows,
  now: serverNow,
  isDemo,
}: {
  rows: BookingRow[];
  now: string;
  isDemo: boolean;
}) {
  const params = useSearchParams();
  // One "today" for the session, from the server's clock, so the first
  // client render sorts exactly as the server did.
  const today = useMemo(() => dayKey(serverNow), [serverNow]);

  const tab = parseTab(params.get("tab"));
  const page = Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1);
  const [search, setSearch] = useState(params.get("q") ?? "");

  // Changes made in the drawer. In a sample workspace they are the only
  // record of the change; live, they hold the server's fresh copy until the
  // list is next fetched.
  const [overrides, setOverrides] = useState<Record<string, BookingDetail>>({});
  const rows = useMemo(
    () => serverRows.map((row) => overrides[row.id] ?? row),
    [serverRows, overrides],
  );

  const setUrl = useCallback((patch: { tab?: BookingTabKey; q?: string }) => {
    const next = new URLSearchParams(window.location.search);
    if (patch.tab) next.set("tab", patch.tab);
    if (patch.q !== undefined) {
      if (patch.q.trim()) next.set("q", patch.q.trim());
      else next.delete("q");
    }
    next.delete("page");
    window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}`);
  }, []);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);
  const onSearch = (value: string) => {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setUrl({ q: value }), 250);
  };

  const matching = useMemo(() => rows.filter((row) => matches(row, search)), [rows, search]);
  const counts = useMemo(() => {
    const result: Record<BookingTabKey, number> = { awaiting: 0, upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 };
    for (const row of matching) result[phaseForBooking(row, today)] += 1;
    return result;
  }, [matching, today]);
  const attention = useMemo(() => {
    const result: Partial<Record<BookingTabKey, number>> = {};
    for (const row of matching) {
      const phase = phaseForBooking(row, today);
      const flagged =
        (phase === "completed" && needsWrapUp(row, today)) ||
        (phase === "cancelled" && row.refundOwedMinor > 0) ||
        (phase === "ongoing" && balanceMinor(row) > 0);
      if (flagged) result[phase] = (result[phase] ?? 0) + 1;
    }
    return result;
  }, [matching, today]);

  /*
   * A booking an action just moved out of this tab stays put, marked
   * "Moved to …", until the operator changes tab — the list must not jump
   * under them while the drawer is still open on that row.
   */
  const [sticky, setSticky] = useState<{ id: string; tab: BookingTabKey } | null>(null);

  const inTab = useMemo(() => {
    const list = matching.filter(
      (row) => phaseForBooking(row, today) === tab || (sticky?.tab === tab && sticky.id === row.id),
    );
    return sortForTab(list, tab, today);
  }, [matching, tab, today, sticky]);

  const pageCount = Math.max(Math.ceil(inTab.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount);
  const visible = inTab.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const [open, setOpen] = useState<{ id: string; promise: Promise<BookingDetail | null> } | null>(null);
  const openBooking = (id: string) => {
    const known = overrides[id];
    setOpen({ id, promise: known ? Promise.resolve(known) : fetchBookingDetail(id) });
  };

  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  });

  const onChange = useCallback(
    (detail: BookingDetail) => {
      const before = overridesRef.current[detail.id] ?? serverRows.find((row) => row.id === detail.id);
      if (before && phaseForBooking(before, today) === tab && phaseForBooking(detail, today) !== tab) {
        setSticky({ id: detail.id, tab });
      }
      setOverrides((previous) => ({ ...previous, [detail.id]: detail }));
    },
    [serverRows, tab, today],
  );

  // False while hydrating, true after — lets the e2e suite wait until rows
  // have handlers rather than guessing with timeouts.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const changeTab = (next: string) => {
    setSticky(null);
    setUrl({ tab: next as BookingTabKey });
  };

  return (
    <>
      <PageBar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Bookings" }]}
        actions={
          <div className="search-wrap hidden w-[280px] md:block">
            <SearchIcon />
            <input
              type="search"
              className="search-input"
              aria-label="Search bookings"
              placeholder="Search name, reference…"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        }
      />

      <div className="surface-card bookings-workspace" data-hydrated={hydrated ? "" : undefined}>
        <div className="card-scroll">
          <div className="search-wrap mb-[14px] w-full md:hidden">
            <SearchIcon />
            <input
              type="search"
              className="search-input"
              aria-label="Search bookings"
              placeholder="Search name, reference…"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>

          <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
            <PillTabs
              label="Booking phase"
              active={tab}
              onChange={changeTab}
              tabs={BOOKING_TABS.map((entry) => ({
                id: entry.key,
                label: entry.label,
                count: counts[entry.key],
                href: `/dashboard/bookings?tab=${entry.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`,
                icon: TAB_ICONS[entry.key],
                countTone: attention[entry.key] ? "warning" : undefined,
                countLabel: attention[entry.key] ? `${attention[entry.key]} need attention` : undefined,
              }))}
            />
            <p className="m-0 text-[11.5px] text-text-muted" aria-live="polite">
              {inTab.length === 0 ? "No bookings" : `Showing ${visible.length} of ${inTab.length}`}
              {isDemo ? " · sample data" : ""}
            </p>
          </div>

          <BookingsTable
            rows={visible}
            tab={tab}
            search={search}
            today={today}
            selectedId={open?.id ?? null}
            movedId={sticky?.tab === tab ? sticky.id : null}
            onOpen={openBooking}
          />

          {pageCount > 1 ? (
            <div className="mt-[14px] flex justify-end">
              <Pagination page={current} pageCount={pageCount} />
            </div>
          ) : null}
        </div>

        {open ? (
          <BookingDrawer
            key={open.id}
            detailPromise={open.promise}
            onClose={() => {
              setOpen(null);
              setSticky(null);
            }}
            onChange={onChange}
          />
        ) : null}
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function parseTab(value: string | null): BookingTabKey {
  return BOOKING_TABS.some((entry) => entry.key === value) ? (value as BookingTabKey) : "upcoming";
}

function matches(row: BookingRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    row.leadName.toLowerCase().includes(needle) ||
    row.reference.toLowerCase().includes(needle) ||
    row.experienceTitle.toLowerCase().includes(needle) ||
    (row.leadEmail?.toLowerCase().includes(needle) ?? false) ||
    (digits.length >= 4 && (row.leadPhone?.replace(/\D/g, "").includes(digits) ?? false))
  );
}

/**
 * Each tab leads with what needs the operator soonest: the nearest
 * departure, the trip ending first, the wrap-up or refund still owed.
 */
function sortForTab(rows: BookingRow[], tab: BookingTabKey, today: string): BookingRow[] {
  const start = (row: BookingRow) => row.travelStart ?? "9999-12-31";
  const end = (row: BookingRow) => lastDay(row) ?? "0000-01-01";
  return [...rows].sort((a, b) => {
    switch (tab) {
      case "awaiting":
      case "upcoming":
        return start(a).localeCompare(start(b));
      case "ongoing":
        return end(a).localeCompare(end(b));
      case "completed": {
        const flag = Number(needsWrapUp(b, today)) - Number(needsWrapUp(a, today));
        return flag || end(b).localeCompare(end(a));
      }
      case "cancelled": {
        const owed = Number(b.refundOwedMinor > 0) - Number(a.refundOwedMinor > 0);
        return owed || start(b).localeCompare(start(a));
      }
    }
  });
}

const subscribeNothing = () => () => {};
