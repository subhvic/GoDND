"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { useSettings } from "@/components/settings/settings-provider";
import { Notice } from "@/components/ui/notice";
import {
  SETTINGS_SECTIONS,
  adjacentSections,
  getSection,
  sectionIndex,
  type ReviewedSection,
  type SectionSlug,
} from "@/lib/settings/model";
import { formatIsoDate } from "@/lib/settings/rules";
import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The frame every section sits in (handoff: Vendor Admin frames) — the
 * seven-segment bar across the top, the title with "Step 5 of 7", the
 * status pill, the form, and Previous Step / Next Step pinned at the foot.
 *
 * The bar and the step count are onboarding furniture: once every section
 * is done they go, and Settings reads as settings rather than a wizard.
 */
export function SectionFrame({
  slug,
  action,
  banner,
  footer,
  children,
}: {
  slug: SectionSlug;
  /** Beside the title — "Edit details" on a sent section. */
  action?: React.ReactNode;
  banner?: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { progress } = useSettings();
  const section = getSection(slug)!;
  const onboarding = progress.done < progress.total;

  return (
    <div className="settings-section">
      {onboarding ? <StepBar current={slug} /> : null}

      <header className="settings-head">
        <div className="min-w-0">
          <h2 className="settings-title">{section.label}</h2>
          <p className="settings-desc">{section.description}</p>
          {onboarding ? (
            <p className="settings-step">
              Step {sectionIndex(slug) + 1} of {SETTINGS_SECTIONS.length}
              {section.reviewed ? <span> · Required to list on GoDND</span> : null}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {banner}

      <div className="settings-body">{children}</div>

      <div className="settings-foot">{footer}</div>
    </div>
  );
}

/** Seven segments; a segment fills when its section needs nothing more. */
function StepBar({ current }: { current: SectionSlug }) {
  const { progress } = useSettings();
  return (
    <div
      className="step-bar"
      role="img"
      aria-label={`${progress.done} of ${progress.total} sections complete`}
    >
      {progress.health.map((entry) => (
        <span
          key={entry.slug}
          className={cn(
            "step-seg",
            entry.health === "complete" && "is-done",
            entry.health === "in_review" && "is-review",
            entry.slug === current && "is-current",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Where a reviewed section stands with GoDND. The unsent state is the
 * file's own red pill ("Your operational details are yet to be submitted");
 * a change request is a full notice, because it carries GoDND's reason.
 */
export function ReviewBanner({
  slug,
  record,
  editing,
  editConsequence,
}: {
  slug: SectionSlug;
  record: ReviewedSection<unknown>;
  editing: boolean;
  editConsequence?: string;
}) {
  const section = getSection(slug)!;

  if (editing && record.status === "verified") {
    return (
      <Notice status="warning" title="You’re changing verified details" className="mb-[16px]" role="status">
        {editConsequence ?? "GoDND checks the change before it replaces what’s verified. Your live experiences stay live meanwhile."}
      </Notice>
    );
  }

  if (record.status === "changes_requested") {
    return (
      <Notice status="critical" title="GoDND asked for changes" className="mb-[16px]" role="status">
        {record.reviewerNote ?? "Update the flagged details and submit again."}
      </Notice>
    );
  }

  const pill = (status: Status, text: string) => (
    <p className="review-pill" data-status={status}>
      <span aria-hidden className={cn("status-dot size-2", status)} />
      {text}
    </p>
  );

  switch (record.status) {
    case "verified":
      return pill("healthy", `Verified by GoDND on ${formatStamp(record.verifiedAt)}.`);
    case "submitted":
      return pill(
        "info",
        `Sent for verification on ${formatStamp(record.submittedAt)}. GoDND is checking it — you can carry on meanwhile.`,
      );
    default:
      return pill("critical", section.pending ?? "");
  }
}

function formatStamp(iso: string | null) {
  return iso ? formatIsoDate(new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) : "—";
}

/** Previous Step on the left; the section's own actions on the right. */
export function FooterNav({
  slug,
  children,
  left,
}: {
  slug: SectionSlug;
  children?: React.ReactNode;
  /** Replaces Previous Step — Cancel, while editing. */
  left?: React.ReactNode;
}) {
  const { navigate } = useSettings();
  const { previous } = adjacentSections(slug);
  return (
    <>
      <div className="flex items-center gap-[8px]">
        {left ??
          (previous ? (
            <button type="button" className="hbtn" onClick={() => navigate(`/dashboard/settings/${previous.slug}`)}>
              <ArrowLeft aria-hidden />
              Previous step
            </button>
          ) : null)}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-[8px]">{children}</div>
    </>
  );
}

export function NextStepButton({ slug, label = "Next step" }: { slug: SectionSlug; label?: string }) {
  const { navigate } = useSettings();
  const { next } = adjacentSections(slug);
  if (!next) return null;
  return (
    <button type="button" className="hbtn primary" onClick={() => navigate(`/dashboard/settings/${next.slug}`)}>
      {label}
      <ArrowRight aria-hidden />
    </button>
  );
}
