"use client";

import Link from "next/link";
import { DropdownMenu as Menu } from "radix-ui";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Flag,
  Link2,
  Mail,
  MoreHorizontal,
  PanelRight,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/enquiries/format";
import { statusForEnquiry } from "@/lib/status";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_HINTS,
  ENQUIRY_STATUS_LABELS,
  type EnquiryRow,
  type EnquiryStatus,
  type TeamMember,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function ThreadHeader({
  row,
  you,
  backHref,
  detailsExpanded,
  onToggleDetails,
  onStage,
  onAssignToMe,
  onMarkUnread,
  onCopyLink,
}: {
  row: EnquiryRow;
  you: TeamMember | null;
  backHref: string;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  onStage: (status: EnquiryStatus) => void;
  onAssignToMe: () => void;
  onMarkUnread: () => void;
  onCopyLink: () => void;
}) {
  const assignedToYou = Boolean(you && row.assignee?.id === you.id);

  return (
    <header className="thread-head">
      <Link href={backHref} scroll={false} className="thread-back" aria-label="Back to enquiries">
        <ChevronLeft aria-hidden />
      </Link>

      <span className="conv-avatar thread-avatar" aria-hidden>
        {initials(row.contactName)}
      </span>

      <div className="thread-id">
        <h2 className="thread-name">
          <span className="truncate">{row.contactName}</span>
          {row.priority === "high" ? (
            <span className="thread-prio" title="High priority">
              <Flag aria-hidden />
              <span className="thread-prio-text">High</span>
              <span className="sr-only"> priority</span>
            </span>
          ) : null}
        </h2>
        <p className="thread-sub">
          <span className="thread-ref">{row.reference}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{ENQUIRY_SOURCE_LABELS[row.source]}</span>
          <span aria-hidden className="thread-sub-extra">·</span>
          <span className="thread-sub-extra truncate">
            {row.assignee ? (assignedToYou ? "Assigned to you" : `Assigned to ${row.assignee.name}`) : "Unassigned"}
          </span>
        </p>
      </div>

      <div className="thread-actions">
        <StageMenu status={row.status} onChange={onStage} />

        <button
          type="button"
          className={buttonClass({ size: "icon", active: detailsExpanded, className: "thread-icon-btn" })}
          aria-label={detailsExpanded ? "Hide enquiry details" : "Show enquiry details"}
          aria-expanded={detailsExpanded}
          onClick={onToggleDetails}
        >
          <PanelRight aria-hidden />
        </button>

        <Menu.Root>
          <Menu.Trigger
            className={buttonClass({ size: "icon", className: "thread-icon-btn" })}
            aria-label="More actions"
          >
            <MoreHorizontal aria-hidden />
          </Menu.Trigger>
          <DropdownMenuContent align="end" className="w-[230px] min-w-0">
            <DropdownMenuSection>
              <DropdownMenuItem onSelect={onMarkUnread}>
                Mark as unread
                <Mail aria-hidden className="size-[14px] text-text-muted" />
              </DropdownMenuItem>
              {you && !assignedToYou ? (
                <DropdownMenuItem onSelect={onAssignToMe}>
                  Assign to me
                  <UserCheck aria-hidden className="size-[14px] text-text-muted" />
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onCopyLink}>
                Copy link
                <Link2 aria-hidden className="size-[14px] text-text-muted" />
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSection>
              {row.status === "spam" ? (
                <DropdownMenuItem onSelect={() => onStage("open")}>Not spam</DropdownMenuItem>
              ) : (
                <DropdownMenuItem danger onSelect={() => onStage("spam")}>
                  Mark as spam
                  <ShieldAlert aria-hidden className="size-[14px]" />
                </DropdownMenuItem>
              )}
            </DropdownMenuSection>
          </DropdownMenuContent>
        </Menu.Root>
      </div>
    </header>
  );
}

/**
 * The pipeline stage as a menu. Each option carries one line of what it
 * means, so "Quoted" vs "Negotiating" is never a guess. Picking Lost asks
 * why (the caller opens that dialog); every other stage applies at once.
 */
export function StageMenu({
  status,
  onChange,
}: {
  status: EnquiryStatus;
  onChange: (status: EnquiryStatus) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className={buttonClass({ className: "stage-btn" })} aria-label={`Stage: ${ENQUIRY_STATUS_LABELS[status]}. Change stage`}>
        <span className={cn("stage-dot", statusForEnquiry(status))} aria-hidden />
        <span>{ENQUIRY_STATUS_LABELS[status]}</span>
        <ChevronDown aria-hidden className="stage-caret" />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="w-[250px] min-w-0">
        <DropdownMenuSection label="Move to stage">
          <Menu.RadioGroup value={status} onValueChange={(value) => onChange(value as EnquiryStatus)}>
            {ENQUIRY_STATUSES.map((value) => (
              <Menu.RadioItem
                key={value}
                value={value}
                className="pop-item stage-option outline-none data-[highlighted]:bg-panel data-[highlighted]:text-text-primary"
              >
                <span className={cn("stage-dot", statusForEnquiry(value))} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="stage-option-label">
                    {ENQUIRY_STATUS_LABELS[value]}
                    {value === "lost" ? "…" : ""}
                  </span>
                  <span className="stage-option-hint">{ENQUIRY_STATUS_HINTS[value]}</span>
                </span>
                <Menu.ItemIndicator>
                  <Check aria-hidden className="size-[14px] text-brand" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </DropdownMenuSection>
      </DropdownMenuContent>
    </Menu.Root>
  );
}
