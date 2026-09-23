"use client";

import { useState } from "react";

import { fetchExperienceDetail } from "@/app/dashboard/experiences/actions";

import { ExperienceDrawer } from "@/components/experiences/experience-drawer";
import {
  EXPERIENCE_KIND_LABELS,
  type ExperienceDetail,
  type ExperienceRow,
  type ExperienceTabKey,
} from "@/lib/types";
import { cn, formatDate, formatDuration, formatMoney } from "@/lib/utils";

/**
 * The Experiences table.
 *
 * Built as a real <table> rather than divs: it is tabular data, and screen
 * reader users need row/column association to make sense of seven columns.
 * Column widths follow the handoff file's measurements proportionally, so the
 * layout holds at 1440px and still reflows on narrower viewports.
 *
 * Rows are buttons in a cell rather than clickable <tr>s — a <tr> cannot take
 * a keyboard focus ring without faking semantics.
 */

const COLUMNS = [
  { key: "name", label: "Experience name", width: "w-[24%] min-w-[220px]" },
  { key: "type", label: "Type", width: "w-[14%] min-w-[130px]" },
  { key: "group", label: "Grp size", width: "w-[10%] min-w-[96px]" },
  { key: "days", label: "No. of Days", width: "w-[10%] min-w-[100px]" },
  { key: "location", label: "Location", width: "w-[15%] min-w-[140px]" },
  { key: "next", label: "Next Availability", width: "w-[16%] min-w-[150px]" },
  { key: "price", label: "Base Price", width: "w-[11%] min-w-[110px]" },
];

export function ExperiencesTable({
  rows,
  tab,
  search,
}: {
  rows: ExperienceRow[];
  tab: ExperienceTabKey;
  search: string;
}) {
  // The detail request starts the moment a row is clicked, so the drawer's
  // fetch overlaps its open animation rather than following it.
  const [open, setOpen] = useState<{
    id: string;
    promise: Promise<ExperienceDetail | null>;
  } | null>(null);

  return (
    <>
      <div className="border border-line-soft bg-surface-sunken p-[4px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <caption className="sr-only-focusable">
              Experiences, filtered to {tab.replace("_", " ")}
              {search ? `, matching “${search}”` : ""}
            </caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-[8px] pb-[14px] pt-[12px] text-small font-semibold text-ink-muted",
                      column.width,
                      column.key === "name" && "pl-[16px]",
                      column.key === "price" && "pr-[16px]",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="p-0">
                    <EmptyState tab={tab} search={search} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    selected={open?.id === row.id}
                    onOpen={() =>
                      setOpen({ id: row.id, promise: fetchExperienceDetail(row.id) })
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* The file draws a fixed 356px white body even when empty. Preserved
            so a short list doesn't collapse the card to a sliver. */}
        {rows.length > 0 && rows.length < 4 ? (
          <div aria-hidden className="h-[120px] bg-white" />
        ) : null}
      </div>

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
  return (
    <tr
      className={cn(
        "border-t border-neutral-5 transition-colors",
        selected ? "bg-brand-surface" : "hover:bg-surface-sunken",
      )}
    >
      <th scope="row" className="py-[12px] pl-[16px] pr-[8px] font-normal">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={selected}
          className="text-left text-small font-medium text-neutral-1 underline-offset-2 hover:underline"
        >
          {row.title}
        </button>
      </th>
      <Cell>{EXPERIENCE_KIND_LABELS[row.kind]}</Cell>
      <Cell>{formatGroupSize(row)}</Cell>
      <Cell>{formatDuration(row.durationDays, row.durationNights)}</Cell>
      <Cell>{row.location.join(", ") || "—"}</Cell>
      <Cell>{formatDate(row.nextAvailableOn)}</Cell>
      <Cell className="pr-[16px]">
        {formatMoney(row.basePriceMinor, row.currency)}
      </Cell>
    </tr>
  );
}

function Cell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-[8px] py-[12px] text-small text-neutral-2",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** "4 - Fixed", "8 - Flexible", "10 - Flexible, 2 groups max" */
function formatGroupSize(row: ExperienceRow) {
  if (!row.groupSize) return "—";
  const sizing = row.groupSizing === "fixed" ? "Fixed" : "Flexible";
  return `${row.groupSize} - ${sizing}`;
}

/**
 * The handoff file draws the empty table as a blank white rectangle with no
 * message at all. An operator landing there has no idea whether it is loading,
 * broken, or genuinely empty — so this adds a plain explanation and a way out.
 */
function EmptyState({
  tab,
  search,
}: {
  tab: ExperienceTabKey;
  search: string;
}) {
  const copy = search
    ? {
        title: `No experiences match “${search}”`,
        body: "Try a shorter search, or clear it to see everything in this tab.",
      }
    : EMPTY_COPY[tab];

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-[6px] px-[24px] py-[48px] text-center">
      <p className="text-body font-medium text-neutral-1">{copy.title}</p>
      <p className="max-w-[420px] text-small text-neutral-2">{copy.body}</p>
    </div>
  );
}

const EMPTY_COPY: Record<ExperienceTabKey, { title: string; body: string }> = {
  active: {
    title: "No active experiences yet",
    body: "Once an experience is approved it appears here, ready to take bookings.",
  },
  under_review: {
    title: "Nothing waiting on review",
    body: "Experiences you submit for marketplace listing show up here while the GoDND team checks them.",
  },
  draft: {
    title: "No drafts",
    body: "Start an experience and save it at any step — it will be waiting here.",
  },
  disabled: {
    title: "No disabled experiences",
    body: "Disabling an experience hides it from travellers without losing its content or history.",
  },
  archived: {
    title: "Nothing archived",
    body: "Archived experiences are kept for your records and past bookings.",
  },
};
