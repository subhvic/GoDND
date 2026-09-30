"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";

import { fetchExperienceDetail } from "@/app/dashboard/experiences/actions";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { ExperienceDrawer } from "@/components/experiences/experience-drawer";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot } from "@/components/ui/status";
import type { BoardCard } from "@/lib/experiences/board";
import { statusForExperience } from "@/lib/status";
import {
  EXPERIENCE_LANES,
  type ExperienceDetail,
  type ExperienceLaneKey,
} from "@/lib/types";

type Lane = (typeof EXPERIENCE_LANES)[number];

/**
 * Experiences as a board: one lane per lifecycle state, every experience on
 * screen at once.
 *
 * The five tabs this replaces showed one state at a time, so answering "what
 * needs me?" meant clicking through all five — and `rejected` had no tab at
 * all, which quietly hid the one state where the operator is actually
 * blocked. Lanes run left to right in the order an experience moves through
 * them, so the board reads as a pipeline rather than a filter.
 *
 * Read-only by design. Under review → Active is the GoDND team's decision,
 * not the operator's, so there is no drag: a board that let you drag a card
 * into Active would be promising control that does not exist. Cards open the
 * same drawer the table opened.
 */
export function ExperiencesBoard({
  lanes,
  search,
  focus,
}: {
  lanes: Record<ExperienceLaneKey, BoardCard[]>;
  search: string;
  focus: ExperienceLaneKey | null;
}) {
  const [open, setOpen] = useState<{
    id: string;
    promise: Promise<ExperienceDetail | null>;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const total = EXPERIENCE_LANES.reduce((sum, lane) => sum + lanes[lane.key].length, 0);

  // A ?tab= link from elsewhere in the portal (the submitted screen, the
  // archive notice, an Insights finding) used to land on a filtered tab.
  // There is no tab to land on now, so bring its lane into view instead.
  useEffect(() => {
    const board = boardRef.current;
    if (!focus || !board) return;
    const lane = board.querySelector<HTMLElement>(`[data-lane="${focus}"]`);
    if (!lane) return;
    lane.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      inline: "start",
      block: "nearest",
    });
  }, [focus]);

  if (total === 0) {
    return (
      <EmptyState
        icon={Compass}
        title={search ? `No experiences match “${search}”` : "No experiences yet"}
        description={
          search
            ? "Search covers titles and regions. Try a shorter term, or clear it to see the whole board."
            : "Your first experience starts as a draft. Save at any step — it waits in the Drafts lane until you submit it."
        }
        action={
          <Link
            href="/dashboard/experiences/new"
            className={buttonClass({ variant: "primary", size: "small" })}
          >
            Add experience
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div
        ref={boardRef}
        className="xp-board"
        role="group"
        aria-label="Experiences by status"
        tabIndex={0}
      >
        {EXPERIENCE_LANES.map((lane) => (
          <BoardLane
            key={lane.key}
            lane={lane}
            cards={lanes[lane.key]}
            filtered={search.trim().length > 0}
            focused={focus === lane.key}
            openId={open?.id ?? null}
            onOpen={(id) =>
              // Started in the handler, not during render, so the request
              // overlaps the drawer opening instead of following it.
              setOpen({ id, promise: fetchExperienceDetail(id) })
            }
          />
        ))}
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

function BoardLane({
  lane,
  cards,
  filtered,
  focused,
  openId,
  onOpen,
}: {
  lane: Lane;
  cards: BoardCard[];
  filtered: boolean;
  focused: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const headingId = `xp-lane-${lane.key}`;
  const status = statusForExperience(lane.key);
  // The one lane the operator is blocked on. Asked of the resolver rather
  // than matched on the key, so "which state is critical" stays decided in
  // one place.
  const needsAttention = status === "critical" && cards.length > 0;

  return (
    <section
      className="xp-lane"
      data-lane={lane.key}
      data-focused={focused ? "" : undefined}
      data-attention={needsAttention ? "" : undefined}
      aria-labelledby={headingId}
    >
      <div className="xp-lane-head">
        {/* Hidden from the heading's name: "Status: Warning Under review"
            is not what this column is called. */}
        <span aria-hidden>
          <StatusDot status={status} size="sm" />
        </span>
        <h2 id={headingId} className="xp-lane-title">
          {lane.label}
          <span className="xp-lane-count">
            {cards.length}
            <span className="sr-only">
              {cards.length === 1 ? " experience" : " experiences"}
            </span>
          </span>
        </h2>
      </div>

      {cards.length === 0 ? (
        <p className="xp-lane-empty">{filtered ? "No matches here." : lane.empty}</p>
      ) : (
        <ul className="xp-lane-body">
          {cards.map((card) => (
            <li key={card.row.id}>
              <ExperienceCard
                card={card}
                selected={openId === card.row.id}
                onOpen={() => onOpen(card.row.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
