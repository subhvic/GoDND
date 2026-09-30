import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  ExperienceDetail,
  ExperienceLaneKey,
  ExperienceRow,
  ExperienceStatus,
  ExperienceTabKey,
  PricingMode,
  RecentExperienceRow,
  Route,
} from "@/lib/types";

/**
 * Data access for the Experiences module.
 *
 * Each function queries Supabase under the caller's session, so RLS does the
 * tenant scoping — there is no `where agency_id = ?` in application code, and
 * a missing filter therefore cannot leak another operator's rows.
 *
 * When Supabase is not configured (a fresh clone, before `.env.local` exists)
 * these fall back to the fixture below so the UI is reviewable. The fallback is
 * keyed off configuration only, never off a query error: an error must surface
 * as an error rather than silently turning into fake data.
 */

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export type ExperienceQuery = {
  tab: ExperienceTabKey;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ExperienceListResult = {
  rows: ExperienceRow[];
  counts: Record<ExperienceTabKey, number>;
  total: number;
  page: number;
  pageCount: number;
  isDemoData: boolean;
};

const PAGE_SIZE = 8;

export async function listExperiences({
  tab,
  search = "",
  page = 1,
  pageSize = PAGE_SIZE,
}: ExperienceQuery): Promise<ExperienceListResult> {
  if (!isSupabaseConfigured()) {
    return demoList({ tab, search, page, pageSize });
  }

  const supabase = await createServerSupabase();

  const counts = await countsByTab(supabase);

  let query = supabase
    .from("experiences")
    .select(
      `id, public_ref, title, kind, status, list_on_marketplace,
       max_group_size, group_sizing, max_parallel_groups,
       duration_days, duration_nights, base_price_minor, currency, updated_at,
       experience_regions ( regions ( name ) ),
       experience_availability ( start_date )`,
      { count: "exact" },
    )
    .eq("status", tab)
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load experiences: ${error.message}`);

  const total = count ?? 0;

  return {
    rows: (data ?? []).map((row) => toExperienceRow(row as unknown as ExperienceRecord)),
    counts,
    total,
    page,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
    isDemoData: false,
  };
}

export type ExperienceBoardResult = {
  lanes: Record<ExperienceLaneKey, ExperienceRow[]>;
  counts: Record<ExperienceLaneKey, number>;
  total: number;
  isDemoData: boolean;
};

/**
 * One read for the whole board, capped. The board shows every lane at once,
 * so paging it would mean six paginations chasing each other; an operator
 * with more experiences than this has a search problem, not a paging one,
 * and the filter above the board is what answers it.
 */
const BOARD_LIMIT = 400;

/**
 * Every experience, grouped into the six lanes the board draws.
 *
 * Deliberately not `listExperiences` six times: that is six round trips, and
 * its per-status query cannot return `rejected` at all, which is how an
 * experience sent back for changes disappeared from this screen.
 */
export async function listExperienceBoard(
  { search = "" }: { search?: string } = {},
): Promise<ExperienceBoardResult> {
  if (!isSupabaseConfigured()) {
    const term = search.trim().toLowerCase();
    return toBoard(
      DEMO.filter((row) => !term || matchesSearch(row, term)),
      true,
    );
  }

  const supabase = await createServerSupabase();

  let query = supabase
    .from("experiences")
    .select(
      `id, public_ref, title, kind, status, list_on_marketplace,
       max_group_size, group_sizing, max_parallel_groups,
       duration_days, duration_nights, base_price_minor, currency, updated_at,
       experience_regions ( regions ( name ) ),
       experience_availability ( start_date )`,
    )
    .order("updated_at", { ascending: false })
    .limit(BOARD_LIMIT);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load experiences: ${error.message}`);

  return toBoard(
    (data ?? []).map((row) => toExperienceRow(row as unknown as ExperienceRecord)),
    false,
  );
}

/** Title or region — an operator searching "Meghalaya" means the place. */
function matchesSearch(row: ExperienceRow, term: string): boolean {
  return (
    row.title.toLowerCase().includes(term) ||
    row.location.some((name) => name.toLowerCase().includes(term))
  );
}

function toBoard(rows: ExperienceRow[], isDemoData: boolean): ExperienceBoardResult {
  const lanes: Record<ExperienceLaneKey, ExperienceRow[]> = {
    draft: [],
    rejected: [],
    under_review: [],
    active: [],
    disabled: [],
    archived: [],
  };

  for (const row of rows) {
    const lane = lanes[row.status as ExperienceLaneKey];
    // A status outside the six lanes would otherwise vanish silently, which
    // is the bug this function exists to stop repeating.
    if (lane) lane.push(row);
  }

  for (const key of Object.keys(lanes) as ExperienceLaneKey[]) {
    lanes[key].sort(laneOrder[key]);
  }

  const counts = Object.fromEntries(
    (Object.keys(lanes) as ExperienceLaneKey[]).map((key) => [key, lanes[key].length]),
  ) as Record<ExperienceLaneKey, number>;

  return {
    lanes,
    counts,
    total: (Object.values(counts) as number[]).reduce((sum, n) => sum + n, 0),
    isDemoData,
  };
}

const olderFirst = (a: ExperienceRow, b: ExperienceRow) =>
  (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "");
const newerFirst = (a: ExperienceRow, b: ExperienceRow) =>
  (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

/**
 * Worst first, lane by lane — the same rule severityRank states for lists.
 *
 *   under_review / rejected  longest wait leads. Three days with GoDND is
 *                            the card you want at the top, not the one
 *                            submitted this morning.
 *   active                   an experience with nothing open to book leads:
 *                            it is live, it is costing the operator nothing
 *                            to keep, and nobody can buy it. Then soonest
 *                            departure, because that is the one to staff.
 *   everything else          most recently touched, which is where an
 *                            operator left off.
 */
const laneOrder: Record<ExperienceLaneKey, (a: ExperienceRow, b: ExperienceRow) => number> = {
  draft: newerFirst,
  rejected: olderFirst,
  under_review: olderFirst,
  active: (a, b) => {
    if (!a.nextAvailableOn !== !b.nextAvailableOn) return a.nextAvailableOn ? 1 : -1;
    if (!a.nextAvailableOn || !b.nextAvailableOn) return newerFirst(a, b);
    return a.nextAvailableOn.localeCompare(b.nextAvailableOn);
  },
  disabled: newerFirst,
  archived: newerFirst,
};

/**
 * Home's "Recently created experiences": newest first, every state — a
 * fresh draft is exactly what an operator comes back to finish.
 */
export async function listRecentExperiences(limit = 3): Promise<RecentExperienceRow[]> {
  if (!isSupabaseConfigured()) {
    return DEMO.map(withDemoExtras)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("experiences")
    .select(
      `id, public_ref, title, kind, status, list_on_marketplace,
       max_group_size, group_sizing, max_parallel_groups,
       duration_days, duration_nights, base_price_minor, currency,
       pricing_mode, pickup_location, dropoff_location, created_at, updated_at,
       experience_regions ( regions ( name ) ),
       experience_availability ( start_date, end_date, is_open )`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent experiences: ${error.message}`);

  return (data ?? []).map((raw) => {
    const record = raw as unknown as RecentExperienceRecord;
    const today = new Date().toISOString().slice(0, 10);
    const lastOpen = (record.experience_availability ?? [])
      .filter((slot) => slot.is_open && slot.end_date >= today)
      .map((slot) => slot.end_date)
      .sort()
      .at(-1);

    return {
      ...toExperienceRow(record),
      createdAt: record.created_at,
      route: toRoute(record.pickup_location, record.dropoff_location),
      availableUntil: lastOpen ?? null,
      pricingMode: record.pricing_mode,
    };
  });
}

type RecentExperienceRecord = Omit<ExperienceRecord, "experience_availability"> & {
  pricing_mode: PricingMode;
  pickup_location: string | null;
  dropoff_location: string | null;
  created_at: string;
  experience_availability?: { start_date: string; end_date: string; is_open: boolean }[] | null;
};

/** A route only when both ends are known; a draft with half a route has none yet. */
function toRoute(from: string | null | undefined, to: string | null | undefined): Route | null {
  return from && to ? { from, to } : null;
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Tab counts come from one grouped round trip rather than five `head: true`
 * queries — the tab bar renders every count on first paint, so five requests
 * would be five times the latency for the same information.
 */
async function countsByTab(
  supabase: SupabaseClient,
): Promise<Record<ExperienceTabKey, number>> {
  const empty: Record<ExperienceTabKey, number> = {
    active: 0,
    under_review: 0,
    draft: 0,
    disabled: 0,
    archived: 0,
  };

  const { data, error } = await supabase.from("experiences").select("status");
  if (error) return empty;

  return (data ?? []).reduce((acc, row) => {
    const key = row.status as ExperienceTabKey;
    if (key in acc) acc[key] += 1;
    return acc;
  }, empty);
}

type ExperienceRecord = {
  id: string;
  public_ref: string;
  title: string;
  kind: string;
  status: string;
  list_on_marketplace: boolean;
  max_group_size: number | null;
  group_sizing: string;
  max_parallel_groups: number | null;
  duration_days: number | null;
  duration_nights: number | null;
  base_price_minor: number | null;
  currency: string;
  updated_at?: string | null;
  experience_regions?: { regions: { name: string } | null }[] | null;
  experience_availability?: { start_date: string }[] | null;
};

function toExperienceRow(record: ExperienceRecord): ExperienceRow {
  const upcoming = (record.experience_availability ?? [])
    .map((slot) => slot.start_date)
    .filter((date) => new Date(date) >= new Date())
    .sort();

  return {
    id: record.id,
    publicRef: record.public_ref,
    title: record.title,
    kind: record.kind as ExperienceRow["kind"],
    status: record.status as ExperienceStatus,
    listOnMarketplace: record.list_on_marketplace,
    groupSize: record.max_group_size,
    groupSizing: record.group_sizing as ExperienceRow["groupSizing"],
    maxParallelGroups: record.max_parallel_groups,
    durationDays: record.duration_days,
    durationNights: record.duration_nights,
    location: (record.experience_regions ?? [])
      .map((link) => link.regions?.name)
      .filter((name): name is string => Boolean(name)),
    nextAvailableOn: upcoming[0] ?? null,
    basePriceMinor: record.base_price_minor,
    currency: record.currency,
    updatedAt: record.updated_at ?? null,
  };
}

/* ---------------------------------------------------------------------------
 * Demo fixture — shape-identical to what Supabase returns, so swapping in a
 * real project changes nothing above the data layer. Content mirrors the rows
 * drawn in the handoff file.
 * ------------------------------------------------------------------------ */

/**
 * Fixture departures are relative to today. Hardcoded dates go stale and the
 * table ends up offering a next availability that has already passed.
 */
function inDays(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * The other direction, for "waiting 4 days" and "edited 2 days ago". Same
 * reason as inDays: a hardcoded timestamp would have a draft edited two years
 * ago the moment this fixture ages.
 */
function daysAgo(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  date.setHours(11, 20, 0, 0);
  return date.toISOString();
}

const DEMO: ExperienceRow[] = [
  {
    id: "demo-1",
    publicRef: "0045835",
    title: "7 Day Immersive Experience in Meghalaya",
    kind: "general_joinee",
    status: "active",
    listOnMarketplace: true,
    groupSize: 10,
    groupSizing: "flexible",
    maxParallelGroups: 2,
    durationDays: 7,
    durationNights: 6,
    location: ["Meghalaya", "Assam"],
    nextAvailableOn: inDays(9),
    basePriceMinor: 6700000,
    currency: "INR",
    updatedAt: daysAgo(34),
  },
  {
    id: "demo-2",
    publicRef: "0045836",
    title: "Cycling & Camping Expedition in Arunachal",
    kind: "general",
    status: "active",
    listOnMarketplace: true,
    groupSize: 4,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 4,
    durationNights: 3,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: inDays(6),
    basePriceMinor: 2450000,
    currency: "INR",
    updatedAt: daysAgo(12),
  },
  {
    id: "demo-3",
    publicRef: "0045837",
    title: "Rafting, Camping & Cycling in Upper Assam",
    kind: "super",
    status: "active",
    listOnMarketplace: false,
    groupSize: 8,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 10,
    durationNights: 9,
    location: ["Assam"],
    nextAvailableOn: inDays(26),
    basePriceMinor: 9800000,
    currency: "INR",
    updatedAt: daysAgo(58),
  },
  {
    id: "demo-4",
    publicRef: "0045838",
    title: "Raw Experience in Meghalaya",
    kind: "quick",
    status: "active",
    listOnMarketplace: true,
    groupSize: 4,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 3,
    durationNights: 2,
    location: ["Meghalaya"],
    nextAvailableOn: inDays(18),
    basePriceMinor: 1850000,
    currency: "INR",
    updatedAt: daysAgo(21),
  },
  {
    id: "demo-5",
    publicRef: "0045839",
    title: "Living Root Bridges Trek",
    kind: "general",
    status: "under_review",
    listOnMarketplace: false,
    groupSize: 6,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 5,
    durationNights: 4,
    location: ["Meghalaya"],
    // Departures are set before submitting; they open once it's approved.
    nextAvailableOn: inDays(74),
    basePriceMinor: 3200000,
    currency: "INR",
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-6",
    publicRef: "0045840",
    title: "Ziro Valley Music & Culture Week",
    kind: "super",
    status: "draft",
    listOnMarketplace: false,
    groupSize: null,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 6,
    durationNights: 5,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: null,
    basePriceMinor: null,
    currency: "INR",
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-7",
    publicRef: "0045841",
    title: "Kaziranga Wildlife Weekend",
    kind: "quick",
    status: "disabled",
    listOnMarketplace: false,
    groupSize: 8,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 2,
    durationNights: 1,
    location: ["Assam"],
    nextAvailableOn: null,
    basePriceMinor: 1400000,
    currency: "INR",
    updatedAt: daysAgo(96),
  },
  {
    id: "demo-8",
    publicRef: "0045842",
    title: "Monsoon Nongriat Retreat (2024)",
    kind: "general",
    status: "archived",
    listOnMarketplace: false,
    groupSize: 6,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 4,
    durationNights: 3,
    location: ["Meghalaya"],
    nextAvailableOn: null,
    basePriceMinor: 2100000,
    currency: "INR",
    updatedAt: daysAgo(320),
  },
  {
    // Rejected is one of the six states the drawer’s Edit action supports.
    // A fixture row lets the "Changes requested" banner render against real
    // data instead of being demonstrable only through a schema fake.
    id: "demo-9",
    publicRef: "0045843",
    title: "Bomdila Bird Trail",
    kind: "general",
    status: "rejected",
    listOnMarketplace: false,
    groupSize: 6,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 5,
    durationNights: 4,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: null,
    basePriceMinor: 3200000,
    currency: "INR",
    updatedAt: daysAgo(3),
  },
  /* The rows above are the handoff file's. Those below fill the board out
     to something an operator would recognise — twenty-five experiences
     across all six lanes, including the three states the table could not
     express: live with nothing bookable, live but off-marketplace, and a
     draft stopped before it had a price. */
  {
    id: "demo-10",
    publicRef: "0045844",
    title: "Dzukou Valley Trek from Kohima",
    kind: "general",
    status: "active",
    listOnMarketplace: true,
    groupSize: 12,
    groupSizing: "flexible",
    maxParallelGroups: 2,
    durationDays: 3,
    durationNights: 2,
    location: ["Nagaland"],
    nextAvailableOn: inDays(14),
    basePriceMinor: 1450000,
    currency: "INR",
    updatedAt: daysAgo(8),
  },
  {
    id: "demo-11",
    publicRef: "0045845",
    title: "Loktak Lake & Floating Islands",
    kind: "quick",
    status: "active",
    listOnMarketplace: true,
    groupSize: 6,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 2,
    durationNights: 1,
    location: ["Manipur"],
    nextAvailableOn: inDays(4),
    basePriceMinor: 980000,
    currency: "INR",
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-12",
    publicRef: "0045846",
    title: "Tawang Monastery & Sela Pass Circuit",
    kind: "super",
    status: "active",
    listOnMarketplace: true,
    groupSize: 8,
    groupSizing: "flexible",
    maxParallelGroups: 2,
    durationDays: 6,
    durationNights: 5,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: inDays(31),
    basePriceMinor: 4200000,
    currency: "INR",
    updatedAt: daysAgo(19),
  },
  {
    // Live, listed, and with nothing open to book. The board calls this
    // out on the card: the list had no way to show it.
    id: "demo-13",
    publicRef: "0045847",
    title: "Majuli Island Satra & Mask-Making",
    kind: "general",
    status: "active",
    listOnMarketplace: true,
    groupSize: 10,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 3,
    durationNights: 2,
    location: ["Assam"],
    nextAvailableOn: null,
    basePriceMinor: 1120000,
    currency: "INR",
    updatedAt: daysAgo(27),
  },
  {
    // Active but off the marketplace — the operator sells this one
    // themselves. The card says so rather than letting it read as live.
    id: "demo-14",
    publicRef: "0045848",
    title: "Mawlynnong & Dawki Day Trip",
    kind: "quick",
    status: "active",
    listOnMarketplace: false,
    groupSize: 4,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 1,
    durationNights: 0,
    location: ["Meghalaya"],
    nextAvailableOn: inDays(2),
    basePriceMinor: 340000,
    currency: "INR",
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-15",
    publicRef: "0045849",
    title: "Hornbill Festival Week, Kisama",
    kind: "general_joinee",
    status: "active",
    listOnMarketplace: true,
    groupSize: 16,
    groupSizing: "flexible",
    maxParallelGroups: 3,
    durationDays: 5,
    durationNights: 4,
    location: ["Nagaland"],
    nextAvailableOn: inDays(61),
    basePriceMinor: 2800000,
    currency: "INR",
    updatedAt: daysAgo(41),
  },
  {
    // Nine days with the GoDND team. The review lane sorts on this.
    id: "demo-16",
    publicRef: "0045850",
    title: "Siang River Rafting Expedition",
    kind: "super",
    status: "under_review",
    listOnMarketplace: false,
    groupSize: 8,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 4,
    durationNights: 3,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: null,
    basePriceMinor: 1950000,
    currency: "INR",
    updatedAt: daysAgo(9),
  },
  {
    id: "demo-17",
    publicRef: "0045851",
    title: "Unakoti Rock Carvings & Jampui Hills",
    kind: "general",
    status: "under_review",
    listOnMarketplace: false,
    groupSize: 10,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 3,
    durationNights: 2,
    location: ["Tripura"],
    nextAvailableOn: null,
    basePriceMinor: 1290000,
    currency: "INR",
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-18",
    publicRef: "0045852",
    title: "Cherrapunji Caves & Waterfalls",
    kind: "general",
    status: "draft",
    listOnMarketplace: false,
    groupSize: 8,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 2,
    durationNights: 1,
    location: ["Meghalaya"],
    nextAvailableOn: null,
    basePriceMinor: 760000,
    currency: "INR",
    updatedAt: daysAgo(6),
  },
  {
    // A draft stopped before pricing — the card shows what is missing
    // instead of an empty cell, which is what the table did.
    id: "demo-19",
    publicRef: "0045853",
    title: "Aizawl Highlands Homestay Trail",
    kind: "general",
    status: "draft",
    listOnMarketplace: false,
    groupSize: null,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 4,
    durationNights: 3,
    location: ["Mizoram"],
    nextAvailableOn: null,
    basePriceMinor: null,
    currency: "INR",
    updatedAt: daysAgo(11),
  },
  {
    id: "demo-20",
    publicRef: "0045854",
    title: "Manas Tiger Reserve Safari",
    kind: "quick",
    status: "draft",
    listOnMarketplace: false,
    groupSize: 6,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 2,
    durationNights: 1,
    location: ["Assam"],
    nextAvailableOn: null,
    basePriceMinor: 890000,
    currency: "INR",
    updatedAt: daysAgo(23),
  },
  {
    id: "demo-21",
    publicRef: "0045855",
    title: "Nathu La & Tsomgo Lake Day Run",
    kind: "quick",
    status: "rejected",
    listOnMarketplace: false,
    groupSize: 4,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 1,
    durationNights: 0,
    location: ["Sikkim"],
    nextAvailableOn: null,
    basePriceMinor: 520000,
    currency: "INR",
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-22",
    publicRef: "0045856",
    title: "Shillong Cafe & Live Music Crawl",
    kind: "quick",
    status: "disabled",
    listOnMarketplace: false,
    groupSize: 8,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 1,
    durationNights: 0,
    location: ["Meghalaya"],
    nextAvailableOn: null,
    basePriceMinor: 280000,
    currency: "INR",
    updatedAt: daysAgo(74),
  },
  {
    id: "demo-23",
    publicRef: "0045857",
    title: "Ziro Rice-Beer & Apatani Village Walk",
    kind: "general",
    status: "disabled",
    listOnMarketplace: false,
    groupSize: 10,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 2,
    durationNights: 1,
    location: ["Arunachal Pradesh"],
    nextAvailableOn: null,
    basePriceMinor: 840000,
    currency: "INR",
    updatedAt: daysAgo(112),
  },
  {
    id: "demo-24",
    publicRef: "0045858",
    title: "Assam Tea Estate Harvest (2024)",
    kind: "general",
    status: "archived",
    listOnMarketplace: false,
    groupSize: 12,
    groupSizing: "flexible",
    maxParallelGroups: null,
    durationDays: 3,
    durationNights: 2,
    location: ["Assam"],
    nextAvailableOn: null,
    basePriceMinor: 1500000,
    currency: "INR",
    updatedAt: daysAgo(287),
  },
  {
    id: "demo-25",
    publicRef: "0045859",
    title: "Brahmaputra Cruise Pilot (2023)",
    kind: "super",
    status: "archived",
    listOnMarketplace: false,
    groupSize: 20,
    groupSizing: "fixed",
    maxParallelGroups: null,
    durationDays: 5,
    durationNights: 4,
    location: ["Assam"],
    nextAvailableOn: null,
    basePriceMinor: 5500000,
    currency: "INR",
    updatedAt: daysAgo(512),
  },
];

/**
 * What the Home page needs beyond the list row. Kept beside DEMO rather
 * than inside it so the list fixture stays shape-identical to its query.
 * Created dates put a draft, a submission and a rejection at the top of
 * "Recently created" — the states an operator returns to.
 */
const DEMO_EXTRAS: Record<
  string,
  { createdAt: string; route: Route | null; availableUntil: string | null; pricingMode: PricingMode }
> = {
  "demo-1": { createdAt: "2026-01-12T10:05:00+05:30", route: { from: "Guwahati", to: "Shillong" }, availableUntil: "2026-12-20", pricingMode: "variable" },
  "demo-2": { createdAt: "2026-02-02T16:40:00+05:30", route: { from: "Guwahati", to: "Itanagar" }, availableUntil: "2026-12-15", pricingMode: "variable" },
  "demo-3": { createdAt: "2025-12-05T11:20:00+05:30", route: { from: "Dibrugarh", to: "Jorhat" }, availableUntil: "2026-11-30", pricingMode: "unit_multiply" },
  "demo-4": { createdAt: "2025-11-20T09:15:00+05:30", route: { from: "Shillong", to: "Shillong" }, availableUntil: "2026-12-31", pricingMode: "unit_multiply" },
  "demo-5": { createdAt: "2026-09-16T12:30:00+05:30", route: { from: "Shillong", to: "Shillong" }, availableUntil: "2027-02-28", pricingMode: "unit_multiply" },
  "demo-6": { createdAt: "2026-09-22T18:45:00+05:30", route: null, availableUntil: null, pricingMode: "variable" },
  "demo-7": { createdAt: "2025-10-02T08:50:00+05:30", route: { from: "Guwahati", to: "Kaziranga" }, availableUntil: null, pricingMode: "unit_multiply" },
  "demo-8": { createdAt: "2024-05-10T14:00:00+05:30", route: { from: "Shillong", to: "Shillong" }, availableUntil: null, pricingMode: "unit_multiply" },
  "demo-9": { createdAt: "2026-09-08T15:10:00+05:30", route: { from: "Tezpur", to: "Bomdila" }, availableUntil: null, pricingMode: "unit_multiply" },
};

function withDemoExtras(row: ExperienceRow): RecentExperienceRow {
  const extras = DEMO_EXTRAS[row.id] ?? {
    createdAt: "2026-01-01T00:00:00+05:30",
    route: null,
    availableUntil: null,
    pricingMode: "unit_multiply" as const,
  };
  return { ...row, ...extras };
}

function demoList({
  tab,
  search = "",
  page = 1,
  pageSize = PAGE_SIZE,
}: ExperienceQuery): ExperienceListResult {
  const counts = DEMO.reduce(
    (acc, row) => {
      const key = row.status as ExperienceTabKey;
      if (key in acc) acc[key] += 1;
      return acc;
    },
    { active: 0, under_review: 0, draft: 0, disabled: 0, archived: 0 } as Record<
      ExperienceTabKey,
      number
    >,
  );

  const term = search.trim().toLowerCase();
  const matching = DEMO.filter(
    (row) =>
      row.status === tab &&
      (!term || row.title.toLowerCase().includes(term)),
  );

  return {
    rows: matching.slice((page - 1) * pageSize, page * pageSize),
    counts,
    total: matching.length,
    page,
    pageCount: Math.max(Math.ceil(matching.length / pageSize), 1),
    isDemoData: true,
  };
}

export async function getExperience(
  id: string,
): Promise<ExperienceDetail | null> {
  const row = DEMO.find((item) => item.id === id);
  if (!row) return null;
  const extras = withDemoExtras(row);

  // Detail fields beyond the list shape. Wired to the fixture for now; the
  // Supabase read lands with the drawer's edit actions. Route, pricing mode
  // and inventory come from the same extras Home lists, so a row and its
  // drawer never disagree.
  return {
    ...row,
    ratingAvg: 4.6,
    ratingCount: 92,
    bookingsCompleted: 213,
    upcomingBookings: 4,
    categories: ["Adventure", "Culture & Heritage"],
    activityTags: ["Rafting", "Camping", "Biking", "Swimming"],
    foodIncluded: "Breakfast & Dinner",
    foodPreference: "Both Veg and Non-Veg",
    pickupLocation: extras.route?.from ?? null,
    dropoffLocation: extras.route?.to ?? null,
    tripCaptain: "Madhurjyoti Saikia",
    variablePricing: extras.pricingMode === "variable",
    inventoryUntil: extras.availableUntil,
    photoCount: 24,
    videoCount: 6,
    guestPhotoCount: 9,
    approvalHistory: [
      {
        id: "a3",
        event: "changes_made",
        label: "Approval Requested",
        changesCount: 21,
        occurrence: 2,
        createdAt: "2026-05-15T13:43:00+05:30",
      },
      {
        id: "a2",
        event: "approved",
        label: "Experience Activated",
        changesCount: null,
        occurrence: 1,
        createdAt: "2026-05-15T13:43:00+05:30",
      },
      {
        id: "a1",
        event: "submitted",
        label: "Approval Requested",
        changesCount: null,
        occurrence: 1,
        createdAt: "2026-05-15T13:43:00+05:30",
      },
    ],
  };
}

/**
 * The operator's sellable experiences, for pickers (a quote, a logged
 * enquiry). Active only: quoting something that cannot be booked sets up a
 * conversation that ends in an apology.
 */
export type ExperienceOption = {
  id: string;
  title: string;
  basePriceMinor: number | null;
  currency: string;
};

export async function listExperienceOptions(): Promise<ExperienceOption[]> {
  if (!isSupabaseConfigured()) {
    return DEMO.filter((row) => row.status === "active").map((row) => ({
      id: row.id,
      title: row.title,
      basePriceMinor: row.basePriceMinor,
      currency: row.currency,
    }));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("experiences")
    .select("id, title, base_price_minor, currency")
    .eq("status", "active")
    .order("title");

  if (error) throw new Error(`Failed to load experiences: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    basePriceMinor: (row.base_price_minor as number | null) ?? null,
    currency: (row.currency as string) || "INR",
  }));
}
