"use client";

import Link from "next/link";
import { Compass, Pencil, Plus } from "lucide-react";

import { useHomeRecords } from "@/components/home/home-records";
import { RouteLine } from "@/components/home/route-line";
import { SectionHead } from "@/components/home/section-head";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status";
import { EXPERIENCE_STATE_LABELS, statusForExperience } from "@/lib/status";
import { EXPERIENCE_KIND_LABELS, type RecentExperienceRow } from "@/lib/types";
import { cn, formatDate, formatDuration, formatGroupSize, formatMoney } from "@/lib/utils";

/**
 * "Recently created experiences" — newest first, drafts included, with the
 * handoff file's columns: the list's seven, plus a state and an action.
 * Unfilled fields read "—", which is what makes a half-finished draft easy
 * to spot. The name opens the experience drawer; the pencil goes straight
 * to the editor (archived rows can't be edited, so they get none).
 */
export function RecentExperiences({ rows }: { rows: RecentExperienceRow[] }) {
  const { openId, openExperience } = useHomeRecords();

  return (
    <section className="home-section" aria-labelledby="home-recent-title">
      <SectionHead
        id="home-recent-title"
        title="Recently created experiences"
        link={{ label: "See all experiences", href: "/dashboard/experiences" }}
      />

      <div className="panel">
        {rows.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No experiences yet"
            description="Build your first experience — save it as a draft at any step and it will be waiting here."
            action={
              <Link
                href="/dashboard/experiences/new"
                className={buttonClass({ variant: "primary", size: "small" })}
              >
                <Plus aria-hidden />
                Add experience
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[980px]">
              <caption className="sr-only">
                The {rows.length} most recently created experiences
              </caption>
              <thead>
                <tr>
                  <th scope="col">Experience</th>
                  <th scope="col" className="left">
                    Type
                  </th>
                  <th scope="col">Group size</th>
                  <th scope="col">Duration</th>
                  <th scope="col" className="left">
                    Location
                  </th>
                  <th scope="col">Next availability</th>
                  <th scope="col">Base price</th>
                  <th scope="col" className="left">
                    Status
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selected = openId === row.id;
                  const title = row.title.trim();
                  return (
                    <tr
                      key={row.id}
                      className={cn("clickable", selected && "selected")}
                      onClick={() => openExperience(row.id)}
                    >
                      <th scope="row" className="max-w-[240px]">
                        <button
                          type="button"
                          className={cn(
                            "row-name-btn block max-w-full truncate text-[12.5px] font-medium",
                            !title && "italic text-text-muted",
                          )}
                          aria-expanded={selected}
                          onClick={(event) => {
                            event.stopPropagation();
                            openExperience(row.id);
                          }}
                        >
                          {title || "Untitled experience"}
                        </button>
                      </th>
                      <td className="left">{EXPERIENCE_KIND_LABELS[row.kind]}</td>
                      <td>{formatGroupSize(row.groupSize, row.groupSizing)}</td>
                      <td>{formatDuration(row.durationDays, row.durationNights)}</td>
                      <td className="left">
                        <span className="cell-stack">
                          <span className={row.location.length ? "text-text-primary" : "cell-empty"}>
                            {row.location.join(", ") || "—"}
                          </span>
                          {row.route ? <RouteLine route={row.route} /> : null}
                        </span>
                      </td>
                      <td>
                        <span className="cell-stack">
                          <span className={row.nextAvailableOn ? "text-text-primary" : "cell-empty"}>
                            {formatDate(row.nextAvailableOn)}
                          </span>
                          {row.availableUntil ? (
                            <span className="cell-sub">Expiring on {formatDate(row.availableUntil)}</span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <span className="cell-stack">
                          <span className={row.basePriceMinor != null ? "font-medium text-text-primary" : "cell-empty"}>
                            {formatMoney(row.basePriceMinor, row.currency)}
                          </span>
                          {row.basePriceMinor != null ? (
                            <span className="cell-sub">
                              {row.pricingMode === "variable" ? "per group" : "per head"}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="left">
                        <StatusBadge
                          status={statusForExperience(row.status)}
                          label={EXPERIENCE_STATE_LABELS[row.status] ?? row.status}
                        />
                      </td>
                      <td>
                        {row.status === "archived" ? null : (
                          <Link
                            href={`/dashboard/experiences/${row.id}/edit`}
                            className={buttonClass({ size: "icon" })}
                            aria-label={`Edit ${title || "untitled experience"}`}
                            title="Edit"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Pencil aria-hidden />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
