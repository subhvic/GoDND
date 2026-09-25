"use client";

import { createContext, use, useState } from "react";

import { fetchBookingDetail } from "@/app/dashboard/bookings/actions";
import { fetchExperienceDetail } from "@/app/dashboard/experiences/actions";
import { BookingDrawer } from "@/components/bookings/booking-drawer";
import { ExperienceDrawer } from "@/components/experiences/experience-drawer";
import type { BookingDetail, ExperienceDetail } from "@/lib/types";

/**
 * One record drawer for the whole Home page.
 *
 * Latest bookings and Recently created experiences open the same drawers
 * their full lists do, so a row behaves identically wherever it appears.
 * The two tables sit in different parts of the page, and two drawers must
 * never stack in the same spot, so the open record lives here, above both.
 * The drawer renders inside the surface card, which is the box it overlays.
 */
type OpenRecord =
  | { kind: "booking"; id: string; promise: Promise<BookingDetail | null> }
  | { kind: "experience"; id: string; promise: Promise<ExperienceDetail | null> };

type HomeRecords = {
  openId: string | null;
  openBooking: (id: string) => void;
  openExperience: (id: string) => void;
};

const HomeRecordsContext = createContext<HomeRecords | null>(null);

export function HomeRecordsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenRecord | null>(null);

  const value: HomeRecords = {
    openId: open?.id ?? null,
    // The fetch starts in the click handler, not during render, so it
    // overlaps the drawer opening instead of following it.
    openBooking: (id) => setOpen({ kind: "booking", id, promise: fetchBookingDetail(id) }),
    openExperience: (id) => setOpen({ kind: "experience", id, promise: fetchExperienceDetail(id) }),
  };

  return (
    <HomeRecordsContext value={value}>
      {children}
      {open?.kind === "booking" ? (
        <BookingDrawer key={open.id} detailPromise={open.promise} onClose={() => setOpen(null)} />
      ) : null}
      {open?.kind === "experience" ? (
        <ExperienceDrawer key={open.id} detailPromise={open.promise} onClose={() => setOpen(null)} />
      ) : null}
    </HomeRecordsContext>
  );
}

export function useHomeRecords(): HomeRecords {
  const context = use(HomeRecordsContext);
  if (!context) throw new Error("useHomeRecords must be used inside <HomeRecordsProvider>");
  return context;
}
