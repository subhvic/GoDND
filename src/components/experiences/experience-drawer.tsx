"use client";

import { Suspense, use, useEffect, useRef } from "react";
import {
  CalendarPlus,
  ChevronDown,
  CircleSlash,
  ExternalLink,
  ImagePlus,
  MapPin,
  MoreVertical,
  Pencil,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EXPERIENCE_KIND_LABELS, type ExperienceDetail } from "@/lib/types";
import { cn, formatDate, formatDuration, formatMoney } from "@/lib/utils";

/**
 * Experience detail drawer.
 *
 * Accessibility work the handoff file does not specify, added because a panel
 * that traps neither focus nor Escape is unusable by keyboard:
 *   - rendered as a modal dialog with a labelled heading
 *   - Escape closes, focus moves to the close button on open and is trapped
 *   - background scroll is locked while open
 *
 * Sections are native <details> so they collapse without JavaScript state and
 * announce their expanded/collapsed status for free.
 */
export function ExperienceDrawer({
  detailPromise,
  onClose,
}: {
  /**
   * Started by the caller's click handler, not during render: kicking off a
   * server action while rendering schedules a router update mid-render, which
   * React rejects. Suspense unwraps it here with use().
   */
  detailPromise: Promise<ExperienceDetail | null>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-drawer-title"
        className="relative flex h-full w-full max-w-[415px] flex-col overflow-y-auto bg-white shadow-[0_0_40px_rgba(7,29,24,0.18)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close experience details"
          className="absolute right-[18px] top-[24px] z-10 rounded p-[6px] text-neutral-1 hover:bg-surface-sunken"
        >
          <X aria-hidden className="size-[20px]" />
        </button>

        <Suspense fallback={<DrawerSkeleton />}>
          <DrawerContent promise={detailPromise} />
        </Suspense>
      </div>
    </div>
  );
}

function DrawerContent({
  promise,
}: {
  promise: Promise<ExperienceDetail | null>;
}) {
  const detail = use(promise);

  if (!detail) {
    return (
      <p className="px-[24px] py-[32px] text-small text-neutral-2">
        This experience could not be loaded. It may have been archived or you
        may no longer have access to it.
      </p>
    );
  }

  return <DrawerBody detail={detail} />;
}

function DrawerBody({ detail }: { detail: ExperienceDetail }) {
  return (
    <>
      <h2
        id="experience-drawer-title"
        className="px-[24px] pr-[56px] pt-[24px] text-h3 font-semibold text-neutral-1"
      >
        {detail.title}
      </h2>

      <p className="px-[24px] pt-[6px] text-small text-neutral-2">
        {formatDuration(detail.durationDays, detail.durationNights)} ·{" "}
        {EXPERIENCE_KIND_LABELS[detail.kind]} · Exp ID - {detail.publicRef}
      </p>

      <div className="flex items-start justify-between gap-[16px] px-[24px] pt-[20px]">
        <div>
          <p className="flex items-center gap-[8px]">
            <span className="text-h3 font-semibold text-neutral-1">
              {detail.ratingAvg?.toFixed(1) ?? "—"}
            </span>
            <Stars rating={detail.ratingAvg ?? 0} />
          </p>
          <button
            type="button"
            className="mt-[6px] text-small font-medium text-neutral-1 underline underline-offset-2"
          >
            See all reviews
          </button>
        </div>
        <dl className="space-y-[4px] text-small">
          <div className="flex justify-between gap-[24px]">
            <dt className="text-neutral-2">Bookings Completed:</dt>
            <dd className="font-bold text-neutral-1">{detail.bookingsCompleted}</dd>
          </div>
          <div className="flex justify-between gap-[24px]">
            <dt className="text-neutral-2">Reviews:</dt>
            <dd className="font-bold text-neutral-1">{detail.ratingCount}</dd>
          </div>
        </dl>
      </div>

      {detail.status === "active" ? (
        <div className="mx-[24px] mt-[16px] flex items-center justify-between gap-[12px] bg-brand-soft/40 px-[12px] py-[10px]">
          <span className="text-small font-medium text-ink">
            This experience is active
          </span>
          <span className="text-small text-ink">
            {detail.upcomingBookings} upcoming bookings
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-[10px] px-[24px] pt-[16px]">
        <Button variant="outline" className="flex-1">
          <Pencil aria-hidden className="size-[16px]" />
          Edit Experience
        </Button>
        <Button className="flex-1">
          <ExternalLink aria-hidden className="size-[16px]" />
          Preview
        </Button>
        <button
          type="button"
          aria-label="More actions"
          className="flex size-[40px] shrink-0 items-center justify-center border border-neutral-4 text-neutral-1 hover:bg-surface-sunken"
        >
          <MoreVertical aria-hidden className="size-[18px]" />
        </button>
      </div>

      <div className="mt-[12px] px-[24px] pb-[32px]">
        <Section title="Basic Info" defaultOpen>
          <Facts
            items={[
              ["States/Region", detail.location.join(", ")],
              ["Categories", detail.categories.join(", ")],
              ["Activity Tags", detail.activityTags.join(", ")],
              ["Food Options Available", detail.foodPreference],
            ]}
          />
        </Section>

        <Section title="Itinerary Info" defaultOpen>
          <div className="flex items-start justify-between gap-[8px]">
            <Waypoint label="Pick-up at" value={detail.pickupLocation} />
            <button
              type="button"
              className="flex flex-col items-center text-small font-medium text-brand underline underline-offset-2"
            >
              <span className="text-neutral-2">en-route</span>
              See Itinerary
            </button>
            <Waypoint label="Drop at" value={detail.dropoffLocation} align="right" />
          </div>
        </Section>

        <Section title="Crew, Capacity and Pricing Info" defaultOpen>
          <Facts
            items={[
              ["Trip Captain", detail.tripCaptain],
              ["Group Capacity", formatCapacity(detail)],
              ["Base Price", formatMoney(detail.basePriceMinor, detail.currency)],
              ["Variable Pricing", detail.variablePricing ? "Enabled" : "Disabled"],
            ]}
          />
        </Section>

        <Section title="Availability Info" defaultOpen>
          <Facts
            items={[
              ["Next Available", formatDate(detail.nextAvailableOn)],
              ["Inventory available until", formatDate(detail.inventoryUntil)],
            ]}
          />
          <div className="mt-[12px] flex items-center gap-[24px]">
            <InlineAction icon={<CalendarPlus aria-hidden className="size-[16px]" />}>
              Add availability
            </InlineAction>
            <InlineAction icon={<CircleSlash aria-hidden className="size-[16px] text-[#d92d20]" />}>
              Mark Holidays
            </InlineAction>
          </div>
        </Section>

        <Section title="Media Info" defaultOpen>
          <Facts
            items={[
              ["Photos", `${detail.photoCount} added`],
              ["Videos", `${detail.videoCount} added`],
              ["Media from Guests", `${detail.guestPhotoCount} photos`],
            ]}
          />
          <div className="mt-[12px]">
            <InlineAction icon={<ImagePlus aria-hidden className="size-[16px]" />}>
              Add media
            </InlineAction>
          </div>
        </Section>

        <Section title="Approval History" defaultOpen>
          <ol className="space-y-[12px]">
            {detail.approvalHistory.map((event) => (
              <li key={event.id} className="flex justify-between gap-[16px]">
                <div>
                  <p className="text-small font-medium text-neutral-1">
                    {event.label}
                  </p>
                  <p className="text-small text-neutral-2">
                    {event.changesCount
                      ? `${event.changesCount} Changes made`
                      : ordinal(event.occurrence)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-small text-neutral-2">Date &amp; Time</p>
                  <p className="text-small text-neutral-1">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-neutral-5 py-[16px]">
      <summary className="flex cursor-pointer list-none items-center justify-between text-body font-medium text-neutral-1 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden
          className="size-[20px] text-neutral-2 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pt-[14px]">{children}</div>
    </details>
  );
}

function Facts({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-[16px] gap-y-[14px]">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-small text-neutral-2">{label}</dt>
          <dd className="mt-[2px] text-small font-medium text-neutral-1">
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Waypoint({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-[6px]",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <MapPin aria-hidden className="mt-[2px] size-[14px] shrink-0 text-ink" />
      <div>
        <p className="text-small text-neutral-2">{label}</p>
        <p className="text-small font-medium text-neutral-1">{value || "—"}</p>
      </div>
    </div>
  );
}

function InlineAction({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-[6px] text-small font-medium text-neutral-1 underline underline-offset-2 hover:text-brand"
    >
      {icon}
      {children}
    </button>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-[2px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={cn(
            "size-[16px]",
            index <= Math.round(rating)
              ? "fill-brand text-brand"
              : "text-neutral-3",
          )}
        />
      ))}
    </span>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-[12px] px-[24px] py-[24px]" aria-live="polite">
      <h2 id="experience-drawer-title" className="sr-only-focusable">
        Loading experience details
      </h2>
      {[...Array(6)].map((_, index) => (
        <div key={index} className="h-[48px] animate-pulse bg-surface-sunken" />
      ))}
    </div>
  );
}

function formatCapacity(detail: ExperienceDetail) {
  if (!detail.groupSize) return "—";
  const sizing = detail.groupSizing === "fixed" ? "Fixed" : "Flexible";
  const groups = detail.maxParallelGroups
    ? `, ${detail.maxParallelGroups} groups max.`
    : "";
  return `${detail.groupSize} - ${sizing}${groups}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function ordinal(value: number) {
  const suffix = ["th", "st", "nd", "rd"][
    value % 100 > 10 && value % 100 < 14 ? 0 : Math.min(value % 10, 4) % 4
  ];
  return `${value}${suffix}`;
}
