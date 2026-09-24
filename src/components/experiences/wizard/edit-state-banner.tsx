"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CircleOff,
  Clock,
  FileEdit,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Notice } from "@/components/ui/notice";
import type { ExperienceStatus } from "@/lib/types";

/*
 * The banner shown on every wizard step when an existing experience is being
 * edited. Each state answers one operator question the wizard would otherwise
 * leave hanging:
 *
 *   draft         What am I picking back up?
 *   under_review  If I save now, does that pause the review?
 *   rejected      What did the reviewer want changed?
 *   active        Do my edits go live immediately?
 *   disabled      Does saving republish this?
 *   archived      Handled upstream — the edit route blocks entry.
 *
 * The banner never blocks a control. It informs. The reviewer's-notes list is
 * one line each so it stays visible above the fold on a laptop, and the
 * reference chip on every state carries the id in case an operator needs to
 * quote it in a support message.
 */

const ICONS: Partial<Record<ExperienceStatus, typeof FileEdit>> = {
  draft: FileEdit,
  under_review: Clock,
  rejected: ShieldAlert,
  active: BadgeCheck,
  disabled: CircleOff,
  archived: ShieldCheck,
};

/**
 * Sample reviewer notes. Wired to the fixture for now; the Supabase read
 * lands with the reviews table. The banner renders whatever is passed, or
 * falls back to a single guidance line.
 */
type ReviewerNote = { message: string; step?: string };

const DEMO_REJECTED_NOTES: ReviewerNote[] = [
  {
    message:
      "Cancellation policy doesn't match the refund window on step 4. Please align them.",
    step: "policies",
  },
  {
    message:
      "Group total for 8 guests is missing on the variable pricing table.",
    step: "pricing",
  },
];

export function EditStateBanner({
  reviewerNotes,
}: {
  reviewerNotes?: ReviewerNote[];
}) {
  const { isEditing, originalStatus, experienceId } = useWizard();

  if (!isEditing || !originalStatus) return null;

  const refChip = experienceId ? (
    <span className="ml-[8px] font-mono text-[11px] text-text-muted">
      EXP-{experienceId.slice(0, 8)}
    </span>
  ) : null;

  switch (originalStatus) {
    case "draft":
      return (
        <Notice
          status="info"
          title={
            <>
              Editing a draft
              {refChip}
            </>
          }
          className="mb-[16px]"
        >
          Nothing here is on the marketplace yet. Save at any point and pick
          up later; when you’re ready, send it for approval from the
          review page.
        </Notice>
      );

    case "under_review":
      return (
        <Notice
          status="warning"
          title={
            <>
              Under review — editing will withdraw the submission
              {refChip}
            </>
          }
          className="mb-[16px]"
        >
          Saving any change on this page moves the experience back to Draft
          so the current review can’t be applied to a moving target. The
          review restarts when you send it in again.
        </Notice>
      );

    case "rejected": {
      const notes = reviewerNotes ?? DEMO_REJECTED_NOTES;
      return (
        <Notice
          status="critical"
          title={
            <>
              Changes requested
              {refChip}
            </>
          }
          className="mb-[16px]"
        >
          The reviewer sent this back with a list. Address them and send it
          in again — no need to redo the parts they didn’t flag.
          <ul className="m-0 mt-[8px] list-none p-0">
            {notes.map((note, index) => (
              <li key={index} className="mt-[4px] flex items-start gap-[6px]">
                <span aria-hidden className="mt-[6px] size-[5px] shrink-0 rounded-full bg-critical" />
                <span>
                  {note.message}
                  {note.step ? (
                    <>
                      {" "}
                      <Link
                        href={`/dashboard/experiences/new/${note.step}`}
                        className="text-brand hover:underline"
                      >
                        Open step
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Notice>
      );
    }

    case "active":
      return (
        <Notice
          status="info"
          title={
            <>
              This experience is live
              {refChip}
            </>
          }
          className="mb-[16px]"
        >
          It stays live while you edit. Sending changes for approval starts a
          new review; the current listing on the marketplace doesn’t change
          until the review passes.
        </Notice>
      );

    case "disabled":
      return (
        <Notice
          status="info"
          title={
            <>
              Currently disabled
              {refChip}
            </>
          }
          className="mb-[16px]"
        >
          Guests can’t book this right now. Saving changes doesn’t
          republish it — you’ll need to send it for approval and then
          re-enable it from the row action once approved.
        </Notice>
      );

    case "archived":
      // The edit route redirects an archived experience to a dedicated
      // "restore first" screen, so this state should be unreachable here.
      // Rendering nothing is a safe fallback if it ever isn't.
      return null;

    default:
      return null;
  }
}

/**
 * Icons per state, exported so the edit landing page can use the same
 * vocabulary the banner uses without knowing about it directly.
 */
export const editStateIcons = ICONS;
