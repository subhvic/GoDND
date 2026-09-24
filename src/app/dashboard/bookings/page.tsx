import { Ban, CalendarClock, CheckCircle2, CreditCard } from "lucide-react";

import { BookingsTable } from "@/components/bookings/bookings-table";
import { PageBar } from "@/components/ui/page-bar";
import { Pagination } from "@/components/ui/pagination";
import { PillTabs } from "@/components/ui/pill-tabs";
import { SearchInput } from "@/components/ui/search-input";
import { listBookings } from "@/lib/data/bookings";
import { BOOKING_TABS, type BookingTabKey } from "@/lib/types";

const BOOKING_TAB_ICONS: Record<BookingTabKey, React.ReactNode> = {
  upcoming: <CalendarClock size={13} aria-hidden />,
  awaiting: <CreditCard size={13} aria-hidden />,
  completed: <CheckCircle2 size={13} aria-hidden />,
  cancelled: <Ban size={13} aria-hidden />,
};

export const metadata = { title: "Bookings" };

export default async function BookingsPage(
  props: PageProps<"/dashboard/bookings">,
) {
  const params = await props.searchParams;

  const tab = parseTab(params.tab);
  const search = typeof params.q === "string" ? params.q : "";
  const page = parsePage(params.page);

  const { rows, counts, page: current, pageCount, total } =
    await listBookings({ tab, search, page });

  const tabHref = (key: BookingTabKey) => {
    const next = new URLSearchParams();
    next.set("tab", key);
    if (search) next.set("q", search);
    return `/dashboard/bookings?${next.toString()}`;
  };

  return (
    <>
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Bookings" }]}
        actions={
          <SearchInput
            label="Search bookings"
            placeholder="Search name, reference…"
            className="hidden w-[280px] md:block"
          />
        }
      />

      <div className="surface-card">
      <div className="card-scroll">
        <SearchInput
          label="Search bookings"
          placeholder="Search name, reference…"
          className="mb-[14px] w-full md:hidden"
        />

        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
          <PillTabs
            label="Booking status"
            active={tab}
            tabs={BOOKING_TABS.map((entry) => ({
              id: entry.key,
              label: entry.label,
              count: counts[entry.key],
              href: tabHref(entry.key),
              icon: BOOKING_TAB_ICONS[entry.key],
            }))}
          />
          <p className="m-0 text-[11.5px] text-text-muted">
            Showing {rows.length} of {total}
          </p>
        </div>

        <BookingsTable rows={rows} tab={tab} search={search} />

        <div className="mt-[14px] flex justify-end">
          <Pagination page={current} pageCount={pageCount} />
        </div>
      </div>
      </div>
    </>
  );
}

function parseTab(value: unknown): BookingTabKey {
  if (typeof value !== "string") return "upcoming";
  const match = BOOKING_TABS.find((entry) => entry.key === value);
  return match?.key ?? "upcoming";
}

function parsePage(value: unknown): number {
  if (typeof value !== "string") return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
