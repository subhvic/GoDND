/**
 * Domain types mirroring supabase/migrations. Hand-written rather than
 * generated so the app compiles before a Supabase project exists; regenerate
 * with `supabase gen types typescript` once one does, and delete the overlap.
 */

export const EXPERIENCE_STATUSES = [
  "active",
  "under_review",
  "draft",
  "disabled",
  "archived",
] as const;

export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number] | "rejected";

/** The five Experiences tabs, in the order the handoff file shows them. */
export const EXPERIENCE_TABS = [
  { key: "active", label: "Active" },
  { key: "under_review", label: "Under Review" },
  { key: "draft", label: "Drafts" },
  { key: "disabled", label: "Disabled" },
  { key: "archived", label: "Archived" },
] as const;

export type ExperienceTabKey = (typeof EXPERIENCE_TABS)[number]["key"];

export type ExperienceKind = "general" | "quick" | "super" | "general_joinee";

export const EXPERIENCE_KIND_LABELS: Record<ExperienceKind, string> = {
  general: "General",
  quick: "Quick Experience",
  super: "Super Experience",
  general_joinee: "General - Joinee",
};

export type GroupSizing = "fixed" | "flexible";

/** A row in the Experiences table. */
export type ExperienceRow = {
  id: string;
  publicRef: string;
  title: string;
  kind: ExperienceKind;
  status: ExperienceStatus;
  listOnMarketplace: boolean;
  groupSize: number | null;
  groupSizing: GroupSizing;
  maxParallelGroups: number | null;
  durationDays: number | null;
  durationNights: number | null;
  location: string[];
  nextAvailableOn: string | null;
  basePriceMinor: number | null;
  currency: string;
};

/** Everything the detail drawer renders. */
export type ExperienceDetail = ExperienceRow & {
  ratingAvg: number | null;
  ratingCount: number;
  bookingsCompleted: number;
  upcomingBookings: number;
  categories: string[];
  activityTags: string[];
  foodIncluded: string | null;
  foodPreference: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  tripCaptain: string | null;
  variablePricing: boolean;
  inventoryUntil: string | null;
  photoCount: number;
  videoCount: number;
  guestPhotoCount: number;
  approvalHistory: ApprovalEvent[];
};

export type ApprovalEvent = {
  id: string;
  event: "submitted" | "approved" | "rejected" | "disabled" | "changes_made";
  label: string;
  changesCount: number | null;
  occurrence: number;
  createdAt: string;
};
