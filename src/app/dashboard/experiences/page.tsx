import Link from "next/link";
import { Plus } from "lucide-react";

import { ExperiencesBoard } from "@/components/experiences/experiences-board";
import { buttonClass } from "@/components/ui/button";
import { PageBar } from "@/components/ui/page-bar";
import { SearchInput } from "@/components/ui/search-input";
import { listExperienceBoard } from "@/lib/data/experiences";
import { toBoardCards } from "@/lib/experiences/board";
import { EXPERIENCE_LANES, type ExperienceLaneKey } from "@/lib/types";

export const metadata = { title: "Experiences" };

export default async function ExperiencesPage(
  props: PageProps<"/dashboard/experiences">,
) {
  const params = await props.searchParams;

  const search = typeof params.q === "string" ? params.q : "";
  const focus = parseFocus(params.tab);

  const { lanes, total } = await listExperienceBoard({ search });

  // Signals are worked out here rather than in the client component: they
  // depend on today's date, and a card that renders "Departs in 3 days" on
  // the server and "in 2 days" after hydration is a mismatch waiting for a
  // midnight deploy.
  const cards = toBoardCards(lanes);

  return (
    <>
      <PageBar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Experiences" }]}
        actions={
          <>
            <SearchInput
              label="Search experiences"
              placeholder="Search title or region…"
              className="hidden w-[280px] md:block"
            />
            <Link
              href="/dashboard/experiences/new"
              className={buttonClass({ variant: "primary" })}
            >
              <Plus aria-hidden />
              <span className="hidden sm:inline">Add experience</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </>
        }
      />

      <div className="surface-card">
        <div className="card-scroll">
          {/* Search stays reachable on phones, where the page bar has no room. */}
          <div className="xp-board-bar">
            <SearchInput
              label="Search experiences"
              placeholder="Search title or region…"
              className="w-full md:hidden"
            />
            <p className="xp-board-count" aria-live="polite">
              {search
                ? `${total} ${total === 1 ? "experience matches" : "experiences match"} “${search}”`
                : `${total} ${total === 1 ? "experience" : "experiences"}`}
            </p>
          </div>

          <ExperiencesBoard lanes={cards} search={search} focus={focus} />
        </div>
      </div>
    </>
  );
}

/**
 * ?tab= is what the old five tabs used, and links elsewhere in the portal
 * still carry it. There is no tab to select now, so it picks the lane the
 * board scrolls to instead — the link still means "show me that state".
 */
function parseFocus(value: unknown): ExperienceLaneKey | null {
  const keys = EXPERIENCE_LANES.map((lane) => lane.key) as string[];
  return typeof value === "string" && keys.includes(value)
    ? (value as ExperienceLaneKey)
    : null;
}
