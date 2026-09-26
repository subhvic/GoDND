"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Rocket,
  Share2,
  Sparkles,
} from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { cn } from "@/lib/utils";

/*
 * The confirmation screen shown after "Send for approval".
 *
 * Flash payload: step-media writes {title, ref, submittedAt} to session
 * storage just before it navigates here, then reset()s the draft. This page
 * reads that payload on mount and forgets it immediately, so a refresh does
 * not resurface a stale submission and a direct URL access does not fake one.
 */

export const SUBMISSION_FLASH_KEY = "godnd:last-submission";

type SubmissionFlash = {
  title: string;
  /** Public reference (EXP-nnnn) if the server assigned one. */
  ref: string | null;
  /** Unix millis of the submit. */
  submittedAt: number;
  /** True when the submit updated an existing experience rather than
   * creating a new one; drives the "You updated" hero copy. */
  isUpdate?: boolean;
};

/** Shorten a UUID for display; leave a short id as-is. */
function formatRef(ref: string) {
  return ref.length > 12 ? `EXP-${ref.slice(0, 8)}` : `EXP-${ref}`;
}

type FlashSnapshot = { flash: SubmissionFlash | null } | null;

/**
 * Module-scoped cache so the flash is read (and consumed) exactly once per
 * page load, no matter how many renders happen. useSyncExternalStore calls
 * the snapshot on every render, so a self-clearing readFlash() called there
 * would only work on the first render — and would then return null on the
 * next, causing the confirmation to disappear mid-view.
 */
let cachedSnapshot: FlashSnapshot = null;

function subscribe() {
  // The flash is a one-shot value; there is nothing to subscribe to.
  return () => {};
}

function getClientSnapshot(): FlashSnapshot {
  if (cachedSnapshot === null) {
    cachedSnapshot = { flash: readFlash() };
  }
  return cachedSnapshot;
}

function getServerSnapshot(): FlashSnapshot {
  return null;
}

function readFlash(): SubmissionFlash | null {
  try {
    const raw = window.sessionStorage.getItem(SUBMISSION_FLASH_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(SUBMISSION_FLASH_KEY);
    const parsed = JSON.parse(raw) as Partial<SubmissionFlash>;
    if (!parsed?.title || typeof parsed.submittedAt !== "number") return null;
    return {
      title: parsed.title,
      ref: parsed.ref ?? null,
      submittedAt: parsed.submittedAt,
      isUpdate: parsed.isUpdate ?? false,
    };
  } catch {
    return null;
  }
}

export function SubmittedScreen() {
  // useSyncExternalStore rather than a setState-in-effect: the server has no
  // sessionStorage so the server snapshot is a distinct "not hydrated" marker
  // (null), and the client snapshot is read once, cached in module scope, and
  // returned by every subsequent render. The read consumes the flash so a
  // refresh does not resurface it.
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return (
    <>
      <PageBar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Experiences", href: "/dashboard/experiences" },
          { label: "Sent for approval" },
        ]}
      />
      <main className="surface-card">
        <div className="card-scroll">
          <div className="mx-auto max-w-[820px] pb-[40px]">
            {state === null || state.flash ? (
              <Confirmation flash={state?.flash ?? null} />
            ) : (
              <StaleAccess />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Confirmation({ flash }: { flash: SubmissionFlash | null }) {
  // Server render, and the moment before the effect runs, both show the
  // neutral hero without a title. That's fine: the title is a detail, not
  // the message, and the message is the same either way.
  const title = flash?.title ?? "Your experience";
  const submittedAt = flash?.submittedAt
    ? new Date(flash.submittedAt)
    : new Date();

  return (
    <>
      {/* Hero: the visible acknowledgment. */}
      <section
        aria-labelledby="submitted-title"
        className="flex flex-col items-start gap-[14px]"
      >
        <span
          aria-hidden
          className="flex size-[52px] items-center justify-center rounded-full bg-brand-muted text-brand"
        >
          <CheckCircle2 className="size-[26px]" />
        </span>
        <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
          {flash?.isUpdate ? "Updates queued for review" : "Sent for approval"}
        </p>
        <h2
          id="submitted-title"
          className="m-0 max-w-[28ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.3px] text-text-primary"
        >
          {flash?.isUpdate ? (
            <>Your changes to &ldquo;{title}&rdquo; are on their way.</>
          ) : (
            <>&ldquo;{title}&rdquo; is on its way to the review team.</>
          )}
        </h2>
        <p className="m-0 max-w-[64ch] text-[13px] leading-[1.6] text-text-secondary">
          Submitted{" "}
          <time dateTime={submittedAt.toISOString()}>
            {submittedAt.toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          {flash?.ref ? (
            <>
              {" "}&middot;{" "}
              <span className="font-mono text-text-primary">
                {formatRef(flash.ref)}
              </span>
            </>
          ) : null}
          . Your draft is
          cleared from this device now that it&rsquo;s safely with us.
        </p>
      </section>

      {/* The three stages the submission moves through. This is what closes
          the loop — an operator investing seven steps wants to know when they
          will hear back and what they can do while they wait. */}
      <section aria-labelledby="what-next" className="mt-[36px]">
        <h3
          id="what-next"
          className="m-0 text-[10.5px] font-semibold uppercase tracking-[.9px] text-text-muted"
        >
          What happens next
        </h3>
        <ol className="m-0 mt-[16px] list-none space-y-[10px] p-0">
          <StageRow
            n={1}
            icon={Clock}
            title={flash?.isUpdate ? "Changes under review" : "Under review"}
            time="Typically within 1 working day"
            body={
              flash?.isUpdate
                ? "A reviewer checks the changes against the version that's already live. If they need adjustments, they'll leave notes on the experience and it comes back here as Changes requested — the live listing is not affected in the meantime."
                : "A reviewer checks the itinerary, policies and price for anything a guest could reasonably dispute. If they need a change, they'll leave notes on the experience and it comes back here as Changes requested."
            }
            active
          />
          <StageRow
            n={2}
            icon={Bell}
            title="You'll hear back"
            time="Email + in-app notification"
            body="You'll be notified either way — approved, or with the specific things to fix. Nothing here needs babysitting; you can close the tab."
          />
          <StageRow
            n={3}
            icon={Rocket}
            title={flash?.isUpdate ? "Changes go live" : "Live on the marketplace"}
            time="Immediately on approval"
            body={
              flash?.isUpdate
                ? "Once approved, the updated version replaces the current listing on godnd.co and on your own site. Nothing else about the experience changes."
                : "Once approved, the experience appears on godnd.co and on your own site under Active. Availability windows you set apply from that moment."
            }
          />
        </ol>
      </section>

      {/* Things the operator can do NOW that don't need approval — the wait
          shouldn't feel like dead time. */}
      <section aria-labelledby="meanwhile" className="mt-[36px]">
        <h3
          id="meanwhile"
          className="m-0 text-[10.5px] font-semibold uppercase tracking-[.9px] text-text-muted"
        >
          Meanwhile
        </h3>
        <div className="mt-[14px] grid gap-[10px] md:grid-cols-2">
          <MeanwhileCard
            icon={Eye}
            title="Preview it"
            body="See exactly what a guest will see on the marketplace card and inside the details. Available on your own site immediately, even before approval."
            action="Open preview"
            disabled
            disabledReason="Preview opens when the marketplace is built."
          />
          <MeanwhileCard
            icon={Share2}
            title="Share a private link"
            body="Send trusted guests a link to book directly. Private links stay live even if the marketplace listing needs edits."
            action="Get the link"
            disabled
            disabledReason="Available once approved."
          />
        </div>
      </section>

      {/* Two clear next steps. Primary is the list, because the operator's
          mental model is "I've submitted; where is it?" — they want to see
          the row appear in Under Review. */}
      <div className="mt-[36px] flex flex-wrap items-center gap-[10px] border-t border-border-subtle pt-[24px]">
        <Link
          href="/dashboard/experiences?tab=under_review"
          className={buttonClass({ variant: "primary" })}
        >
          <ArrowRight aria-hidden />
          See it under Under review
        </Link>
        <Link
          href="/dashboard/experiences/new"
          className={buttonClass()}
        >
          <Sparkles aria-hidden />
          Add another experience
        </Link>
        <Link
          href="/dashboard/experiences"
          className={buttonClass()}
        >
          <ArrowLeft aria-hidden />
          Back to Experiences
        </Link>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function StageRow({
  n,
  icon: Icon,
  title,
  time,
  body,
  active,
}: {
  n: number;
  icon: typeof Clock;
  title: string;
  time: string;
  body: string;
  active?: boolean;
}) {
  return (
    <li
      className={cn(
        "panel flex items-start gap-[14px] p-[16px]",
        active && "border-brand-muted bg-brand-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[32px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
          active
            ? "bg-brand text-on-brand"
            : "border border-border-panel bg-panel-2 text-text-secondary",
        )}
      >
        {active ? <Icon className="size-[15px]" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-[10px] gap-y-[2px]">
          <h4 className="m-0 text-[13.5px] font-semibold text-text-primary">
            {title}
          </h4>
          <span
            className={cn(
              "text-[11px]",
              active ? "font-semibold text-brand" : "text-text-muted",
            )}
          >
            {time}
          </span>
        </div>
        <p className="m-0 mt-[4px] text-[12.5px] leading-[1.55] text-text-secondary">
          {body}
        </p>
      </div>
    </li>
  );
}

function MeanwhileCard({
  icon: Icon,
  title,
  body,
  action,
  disabled,
  disabledReason,
}: {
  icon: typeof Eye;
  title: string;
  body: string;
  action: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="panel flex flex-col gap-[10px] p-[16px]">
      <span
        aria-hidden
        className="flex size-[30px] items-center justify-center rounded-md bg-panel-2 text-brand"
      >
        <Icon className="size-[15px]" />
      </span>
      <h4 className="m-0 text-[13px] font-semibold text-text-primary">
        {title}
      </h4>
      <p className="m-0 text-[12px] leading-[1.55] text-text-secondary">
        {body}
      </p>
      <div className="mt-[4px]">
        <Button size="small" disabled={disabled} title={disabledReason}>
          {action}
        </Button>
      </div>
    </div>
  );
}

/**
 * Direct URL access, or a refresh after the flash was consumed. Rather than
 * pretending a submission just happened, name what's actually true.
 */
function StaleAccess() {
  return (
    <div className="mx-auto max-w-[560px] py-[40px]">
      <Notice status="info" title="No recent submission on this device">
        This page appears after you send an experience for approval. Nothing
        was submitted in this browser tab.
      </Notice>
      <div className="mt-[16px] flex flex-wrap items-center gap-[10px]">
        <Link
          href="/dashboard/experiences"
          className={buttonClass({ variant: "primary" })}
        >
          <ArrowLeft aria-hidden />
          Back to Experiences
        </Link>
        <Link
          href="/dashboard/experiences/new"
          className={buttonClass()}
        >
          <Sparkles aria-hidden />
          Start a new experience
        </Link>
      </div>
    </div>
  );
}
