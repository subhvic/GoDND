"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import Link from "next/link";

import { fetchExperienceDetail } from "@/app/dashboard/experiences/actions";
import { ExperienceDrawer } from "@/components/experiences/experience-drawer";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status";
import { EXPERIENCE_STATE_LABELS, statusForExperience } from "@/lib/status";
import {
  EXPERIENCE_KIND_LABELS,
  type ExperienceDetail,
  type ExperienceRow,
  type ExperienceTabKey,
} from "@/lib/types";
import { cn, formatDate, formatDuration, formatMoney } from "@/lib/utils";

/**
 * The Experiences list (source: Panel › DataTable).
 *
 * A real <table>: it is tabular data, and seven columns only make sense to a
 * screen reader through row and column association. Numerics right-align, as
 * the reference does, so prices and counts compare down the column.
 *
 * Each row opens through a button in its first cell rather than a clickable
 * <tr>, which cannot take keyboard focus without faking semantics.
 */
export function ExperiencesTable({
  rows,
  tab,
  search,
}: {
  rows: ExperienceRow[];
  tab: ExperienceTabKey;
  search: string;
}) {
  const [open, setOpen] = useState<{
    id: string;
    promise: Promise<ExperienceDetail | null>;
  } | null>(null);

  return (
    <>
      <Panel title="Experiences" hint={search ? `matching “${search}”` : TAB_HINT[tab]}>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[860px]">
            <caption className="sr-only">
              {EXPERIENCE_STATE_LABELS[tab] ?? tab} experiences
              {search ? `, matching “${search}”` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Experience</th>
                <th scope="col" className="left">Type</th>
                <th scope="col">Group size</th>
                <th scope="col">Duration</th>
                <th scope="col" className="left">Location</th>
                <th scope="col">Next availability</th>
                <th scope="col">Base price</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>
                    <EmptyState
                      icon={Compass}
                      {...(search ? SEARCH_EMPTY(search) : EMPTY_COPY[tab])}
                      action={
                        tab === "active" || tab === "draft" ? (
                          <Link href="/dashboard/experiences/new" className={buttonClass({ variant: "primary", size: "small" })}>
                            Add experience
                          </Link>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    selected={open?.id === row.id}
                    onOpen={() =>
                      // Started in the click handler, not during render, so the
                      // request overlaps the drawer opening.
                      setOpen({ id: row.id, promise: fetchExperienceDetail(row.id) })
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {open ? (
        <ExperienceDrawer
          key={open.id}
          detailPromise={open.promise}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function Row({
  row,
  selected,
  onOpen,
}: {
  row: ExperienceRow;
  selected: boolean;
  onOpen: () => void;
}) {
  const status = statusForExperience(row.status);

  return (
    <tr className={cn("clickable", selected && "selected")} onClick={onOpen}>
      <th scope="row" className="max-w-[320px]">
        <span className="row-name">
          <StatusDot status={status} label={EXPERIENCE_STATE_LABELS[row.status]} />
          <button
            type="button"
            className="row-name-btn truncate text-[12.5px]"
            aria-expanded={selected}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            {row.title}
          </button>
        </span>
      </th>
      <td className="left">{EXPERIENCE_KIND_LABELS[row.kind]}</td>
      <td>{formatGroupSize(row)}</td>
      <td>{formatDuration(row.durationDays, row.durationNights)}</td>
      <td className="left">{row.location.join(", ") || "—"}</td>
      <td>{formatDate(row.nextAvailableOn)}</td>
      <td className="primary font-medium">{formatMoney(row.basePriceMinor, row.currency)}</td>
    </tr>
  );
}

/** "4 · Fixed", "8 · Flexible" */
function formatGroupSize(row: ExperienceRow) {
  if (!row.groupSize) return "—";
  return `${row.groupSize} · ${row.groupSizing === "fixed" ? "Fixed" : "Flexible"}`;
}

const TAB_HINT: Record<ExperienceTabKey, string> = {
  active: "live and bookable",
  under_review: "waiting on the GoDND team",
  draft: "not yet submitted",
  disabled: "hidden from travellers",
  archived: "kept for your records",
};

const SEARCH_EMPTY = (search: string) => ({
  title: `No experiences match “${search}”`,
  description: "Try a shorter search, or clear it to see everything in this tab.",
});

const EMPTY_COPY: Record<ExperienceTabKey, { title: string; description: string }> = {
  active: {
    title: "No active experiences yet",
    description: "Once an experience is approved it appears here, ready to take bookings.",
  },
  under_review: {
    title: "Nothing waiting on review",
    description: "Experiences you submit for the marketplace show up here while the GoDND team checks them.",
  },
  draft: {
    title: "No drafts",
    description: "Start an experience and save it at any step — it will be waiting here.",
  },
  disabled: {
    title: "No disabled experiences",
    description: "Disabling an experience hides it from travellers without losing its content or history.",
  },
  archived: {
    title: "Nothing archived",
    description: "Archived experiences are kept for your records and past bookings.",
  },
};
