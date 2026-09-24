import Link from "next/link";
import { Plus } from "lucide-react";

import { ExperiencesTable } from "@/components/experiences/experiences-table";
import { buttonClass } from "@/components/ui/button";
import { PageBar } from "@/components/ui/page-bar";
import { Pagination } from "@/components/ui/pagination";
import { PillTabs } from "@/components/ui/pill-tabs";
import { SearchInput } from "@/components/ui/search-input";
import { listExperiences } from "@/lib/data/experiences";
import { EXPERIENCE_TABS, type ExperienceTabKey } from "@/lib/types";

export const metadata = { title: "Experiences" };

export default async function ExperiencesPage(
  props: PageProps<"/dashboard/experiences">,
) {
  const params = await props.searchParams;

  const tab = parseTab(params.tab);
  const search = typeof params.q === "string" ? params.q : "";
  const page = parsePage(params.page);

  const { rows, counts, page: current, pageCount, total } =
    await listExperiences({ tab, search, page });

  const tabHref = (key: ExperienceTabKey) => {
    const next = new URLSearchParams();
    next.set("tab", key);
    if (search) next.set("q", search);
    return `/dashboard/experiences?${next.toString()}`;
  };

  return (
    <div className="surface-card">
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Experiences" }]}
        actions={
          <>
            <SearchInput
              label="Search experiences"
              placeholder="Search experiences…"
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

      <div className="card-scroll">
        {/* Search stays reachable on phones, where the page bar has no room. */}
        <SearchInput
          label="Search experiences"
          placeholder="Search experiences…"
          className="mb-[14px] w-full md:hidden"
        />

        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
          <PillTabs
            label="Experience status"
            active={tab}
            tabs={EXPERIENCE_TABS.map((item) => ({
              id: item.key,
              label: item.label,
              count: counts[item.key] ?? 0,
              href: tabHref(item.key),
            }))}
          />
          <p className="text-[11.5px] text-text-muted" aria-live="polite">
            {total === 0 ? "No experiences" : `Showing ${rows.length} of ${total}`}
          </p>
        </div>

        <ExperiencesTable rows={rows} tab={tab} search={search} />

        {pageCount > 1 ? (
          <div className="mt-[14px] flex justify-end">
            <Pagination page={current} pageCount={pageCount} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function parseTab(value: unknown): ExperienceTabKey {
  const keys = EXPERIENCE_TABS.map((tab) => tab.key) as string[];
  return typeof value === "string" && keys.includes(value)
    ? (value as ExperienceTabKey)
    : "active";
}

function parsePage(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
