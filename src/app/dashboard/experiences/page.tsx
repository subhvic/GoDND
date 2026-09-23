import Link from "next/link";
import { Inbox, Plus } from "lucide-react";

import { ExperienceTabs } from "@/components/experiences/experience-tabs";
import { ExperiencesTable } from "@/components/experiences/experiences-table";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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

  const { rows, counts, page: current, pageCount, total, isDemoData } =
    await listExperiences({ tab, search, page });

  return (
    <div className="flex flex-col gap-[24px] pb-[40px]">
      <header className="flex flex-col gap-[16px] px-[16px] py-[12px] lg:flex-row lg:items-center lg:justify-between lg:pl-[32px] lg:pr-[36px]">
        <h1 className="flex items-end gap-[7px] text-h3 font-semibold text-neutral-1">
          <Inbox aria-hidden className="size-[24px]" />
          Experiences
        </h1>

        <div className="flex items-center gap-[18px]">
          <SearchInput
            label="Search experiences"
            placeholder="Search Experience"
            className="w-full lg:w-[613px]"
          />
          <Link
            href="/dashboard/experiences/new"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Plus aria-hidden className="size-[20px]" />
            <span className="hidden sm:inline">Add New Experience</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-px">
        <ExperienceTabs active={tab} counts={counts} />

        <div className="flex flex-col gap-[16px] px-[16px] py-[18px] lg:px-[32px]">
          {isDemoData ? <DemoNotice /> : null}

          <ExperiencesTable rows={rows} tab={tab} search={search} />

          {total > 0 ? (
            <div className="flex flex-col items-center justify-between gap-[12px] sm:flex-row">
              <p className="text-small text-neutral-2" aria-live="polite">
                Showing {rows.length} of {total}
              </p>
              <Pagination page={current} pageCount={pageCount} />
            </div>
          ) : null}
        </div>
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

/**
 * Shown only when Supabase is unconfigured. Better an explicit banner than an
 * operator mistaking fixture rows for their own data.
 */
function DemoNotice() {
  return (
    <p className="border border-line-soft bg-brand-surface px-[12px] py-[8px] text-small text-ink">
      Showing sample data — add your Supabase keys to{" "}
      <code className="font-mono">.env.local</code> to connect real experiences.
    </p>
  );
}
