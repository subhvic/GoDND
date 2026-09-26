import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  ExperienceDetail,
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
       duration_days, duration_nights, base_price_minor, currency,
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
       pricing_mode, pickup_location, dropoff_location, created_at,
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
  };
}

/* ---------------------------------------------------------------------------
 * Demo fixture — shape-identical to what Supabase returns, so swapping in a
 * real project changes nothing above the data layer. Content mirrors the rows
 * drawn in the handoff file.
 * ------------------------------------------------------------------------ */

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
    nextAvailableOn: "2026-05-15",
    basePriceMinor: 6700000,
    currency: "INR",
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
    nextAvailableOn: "2026-04-02",
    basePriceMinor: 2450000,
    currency: "INR",
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
    nextAvailableOn: "2026-06-11",
    basePriceMinor: 9800000,
    currency: "INR",
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
    nextAvailableOn: "2026-03-28",
    basePriceMinor: 1850000,
    currency: "INR",
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
    nextAvailableOn: "2026-10-18",
    basePriceMinor: 3200000,
    currency: "INR",
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
