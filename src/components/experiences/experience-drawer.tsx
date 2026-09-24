"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Star } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { RecordDrawer, RecordField, RecordSection } from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status";
import { EXPERIENCE_STATE_LABELS, statusForExperience } from "@/lib/status";
import { EXPERIENCE_KIND_LABELS, type ExperienceDetail } from "@/lib/types";
import { formatDate, formatDuration, formatMoney } from "@/lib/utils";

/**
 * Experience detail — the reference Logs page's record drawer, carrying the
 * handoff file's drawer content (Basic, Itinerary, Crew & pricing,
 * Availability, Media, Approval history).
 *
 * The detail request starts in the row's click handler and is unwrapped here
 * with use(), so Suspense drives the loading state and the fetch overlaps the
 * drawer opening instead of following it.
 */
export function ExperienceDrawer({
  detailPromise,
  onClose,
}: {
  detailPromise: Promise<ExperienceDetail | null>;
  onClose: () => void;
}) {
  return (
    <Suspense fallback={<LoadingDrawer onClose={onClose} />}>
      <DrawerContent promise={detailPromise} onClose={onClose} />
    </Suspense>
  );
}

function DrawerContent({
  promise,
  onClose,
}: {
  promise: Promise<ExperienceDetail | null>;
  onClose: () => void;
}) {
  const detail = use(promise);
  const close = (open: boolean) => {
    if (!open) onClose();
  };

  if (!detail) {
    return (
      <RecordDrawer open onOpenChange={close} title="Experience unavailable">
        <div className="p-[16px]">
          <Notice status="warning" title="This experience could not be loaded">
            It may have been archived, or you may no longer have access to it.
          </Notice>
        </div>
      </RecordDrawer>
    );
  }

  const status = statusForExperience(detail.status);

  return (
    <RecordDrawer
      open
      onOpenChange={close}
      title={detail.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
          <StatusBadge status={status} label={EXPERIENCE_STATE_LABELS[detail.status]} />
          <span>{formatDuration(detail.durationDays, detail.durationNights)}</span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>{EXPERIENCE_KIND_LABELS[detail.kind]}</span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>EXP-{detail.publicRef}</span>
        </span>
      }
      actions={
        <>
          <Link href="/dashboard/experiences/new/basic-info" className={buttonClass()}>
            <Pencil aria-hidden />
            Edit
          </Link>
          <button type="button" className={buttonClass({ variant: "primary" })} disabled title="The guest preview is not built yet">
            <ExternalLink aria-hidden />
            Preview
          </button>
        </>
      }
    >
      {/* Performance first — the same order the reference drawer follows:
          what is happening, then what the record is. */}
      <div className="grid grid-cols-3 gap-px border-b border-border-subtle bg-border-subtle">
        <Metric label="Rating">
          <span className="flex items-center gap-[5px]">
            {detail.ratingAvg?.toFixed(1) ?? "—"}
            <Star aria-hidden className="size-[13px] fill-brand text-brand" />
          </span>
          <span className="text-[10.5px] font-normal text-text-muted">{detail.ratingCount} reviews</span>
        </Metric>
        <Metric label="Completed">
          {detail.bookingsCompleted}
          <span className="text-[10.5px] font-normal text-text-muted">bookings</span>
        </Metric>
        <Metric label="Upcoming">
          {detail.upcomingBookings}
          <span className="text-[10.5px] font-normal text-text-muted">bookings</span>
        </Metric>
      </div>

      <RecordSection title="Basic info">
        <RecordField label="Regions">{detail.location.join(", ")}</RecordField>
        <RecordField label="Categories">{detail.categories.join(", ")}</RecordField>
        <RecordField label="Activity tags">{detail.activityTags.join(", ")}</RecordField>
        <RecordField label="Food">{[detail.foodIncluded, detail.foodPreference].filter(Boolean).join(" · ")}</RecordField>
      </RecordSection>

      <RecordSection title="Itinerary">
        <RecordField label="Pick-up">{detail.pickupLocation}</RecordField>
        <RecordField label="Drop-off">{detail.dropoffLocation}</RecordField>
      </RecordSection>

      <RecordSection title="Crew, capacity & pricing">
        <RecordField label="Trip captain">{detail.tripCaptain}</RecordField>
        <RecordField label="Group capacity">{formatCapacity(detail)}</RecordField>
        <RecordField label="Base price">{formatMoney(detail.basePriceMinor, detail.currency)} per guest</RecordField>
        <RecordField label="Variable pricing">{detail.variablePricing ? "Enabled" : "Off"}</RecordField>
      </RecordSection>

      <RecordSection title="Availability">
        <RecordField label="Next available">{formatDate(detail.nextAvailableOn)}</RecordField>
        <RecordField label="Inventory until">{formatDate(detail.inventoryUntil)}</RecordField>
      </RecordSection>

      <RecordSection title="Media" defaultOpen={false}>
        <RecordField label="Photos">{detail.photoCount}</RecordField>
        <RecordField label="Videos">{detail.videoCount}</RecordField>
        <RecordField label="From guests">{detail.guestPhotoCount} photos</RecordField>
      </RecordSection>

      <RecordSection title="Approval history">
        {detail.approvalHistory.map((event) => (
          <RecordField key={event.id} label={formatDateTime(event.createdAt)}>
            {event.label}
            <span className="text-text-muted">
              {" · "}
              {event.changesCount ? `${event.changesCount} changes` : `revision ${event.occurrence}`}
            </span>
          </RecordField>
        ))}
      </RecordSection>
    </RecordDrawer>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px] bg-card px-[16px] py-[12px]">
      <span className="record-key">{label}</span>
      <span className="flex flex-col text-[15px] font-semibold text-text-primary">{children}</span>
    </div>
  );
}

function LoadingDrawer({ onClose }: { onClose: () => void }) {
  return (
    <RecordDrawer open onOpenChange={(open) => !open && onClose()} title="Loading experience…">
      <div className="flex flex-col gap-[10px] p-[16px]" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="skeleton h-[34px]" />
        ))}
      </div>
    </RecordDrawer>
  );
}

function formatCapacity(detail: ExperienceDetail) {
  if (!detail.groupSize) return "—";
  const sizing = detail.groupSizing === "fixed" ? "Fixed" : "Flexible";
  const groups = detail.maxParallelGroups ? `, up to ${detail.maxParallelGroups} groups` : "";
  return `${detail.groupSize} guests · ${sizing}${groups}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
