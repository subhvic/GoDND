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

/* ==========================================================================
   Bookings
   ========================================================================== */

/**
 * The eight-state booking lifecycle from the schema, plus the grouping the
 * operator sees on the list. The DB carries every distinct state; the UI
 * collapses them into four tabs because "confirmed / paid / partially_paid"
 * are all just "upcoming, money is coming" to an operator scanning the list.
 */
export const BOOKING_STATUSES = [
  "draft",
  "pending_payment",
  "confirmed",
  "partially_paid",
  "paid",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  partially_paid: "Part-paid",
  paid: "Paid",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const BOOKING_TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "awaiting", label: "Awaiting payment" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export type BookingTabKey = (typeof BOOKING_TABS)[number]["key"];

/** Which DB statuses land under which operator-facing tab. */
export const BOOKING_TAB_STATUSES: Record<BookingTabKey, BookingStatus[]> = {
  upcoming: ["confirmed", "paid", "partially_paid"],
  awaiting: ["pending_payment", "draft"],
  completed: ["completed"],
  cancelled: ["cancelled", "refunded"],
};

export type BookingRow = {
  id: string;
  reference: string;              // BKG-000142
  status: BookingStatus;
  isMarketplace: boolean;
  experienceTitle: string;
  experienceId: string | null;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  travelStart: string | null;
  travelEnd: string | null;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  refundedMinor: number;
  commissionMinor: number;
  createdAt: string;
};

export type BookingDetail = BookingRow & {
  /** Other travellers on the same booking, in seat order. */
  guests: BookingGuest[];
  /** Chronological, oldest first. */
  timeline: BookingEvent[];
  /** Payments recorded against this booking. */
  payments: BookingPayment[];
  /** Snapshot of what the operator sold at the time of booking. */
  experienceSnapshot: {
    durationDays: number | null;
    location: string[];
    thumbnailNote: string | null;
  };
  cancellationReason: string | null;
  notes: string | null;
};

export type BookingGuest = {
  id: string;
  fullName: string;
  ageBucket: "adult" | "child" | "infant";
  role: "lead" | "guest";
};

export type BookingEvent = {
  id: string;
  kind:
    | "created"
    | "payment_captured"
    | "confirmed"
    | "reminder_sent"
    | "checked_in"
    | "completed"
    | "cancelled"
    | "refunded"
    | "note";
  label: string;
  detail?: string | null;
  amountMinor?: number | null;
  createdAt: string;
};

export type BookingPayment = {
  id: string;
  method: "razorpay" | "cash" | "bank_transfer" | "other";
  status: "authorized" | "captured" | "failed" | "refunded";
  amountMinor: number;
  createdAt: string;
  reference: string | null;
};

/* ==========================================================================
   Home
   ========================================================================== */

/** Pick-up → drop, the "Guwahati → Itanagar" line under a location. */
export type Route = { from: string; to: string };

/** "Latest bookings" on Home: who booked, where to, when, and when they travel. */
export type LatestBookingRow = BookingRow & {
  /** State(s) the experience runs in — the snapshot's, else the live row's. */
  location: string[];
  route: Route | null;
};

export type PricingMode = "unit_multiply" | "variable";

/** "Recently created experiences" on Home — newest first, drafts included. */
export type RecentExperienceRow = ExperienceRow & {
  createdAt: string;
  route: Route | null;
  /** Last open departure: the file's "Expiring on …" under next availability. */
  availableUntil: string | null;
  /** unit_multiply prices a guest ("per head"); variable prices the group. */
  pricingMode: PricingMode;
};

/**
 * The funnel strip's time windows. Rolling rather than calendar periods, so
 * "+18%" always compares two windows of equal length and the strip doesn't
 * reset to near-zero on the first of the month.
 */
export const FUNNEL_PERIODS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
] as const;

export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number]["key"];

/**
 * One window of "My experience funnel". Each "previous" value is the same
 * count over the window before, for the growth caption.
 *
 * The two cancellation tiles split on money, because the schema does:
 * a reservation cancelled before payment ends `cancelled`, a paid booking
 * cancelled afterwards ends `refunded`.
 */
export type FunnelFigures = {
  activeExperiences: number;
  /** Went live inside the window. */
  newlyActive: number;
  reservationsMade: number;
  reservationsMadePrevious: number;
  reservationsCancelled: number;
  bookingsCompleted: number;
  bookingsCompletedPrevious: number;
  reviewsReceived: number;
  averageRating: number | null;
  bookingsCancelled: number;
};

export type ConversionGranularity = "monthly" | "weekly";

export type ConversionPoint = {
  /** ISO date the bucket starts on. */
  key: string;
  /** Axis label: "Mar ’26", or "Sep 1" for a week. */
  label: string;
  /** A week's second axis line: "– Sep 7". */
  sublabel?: string;
  /** Tooltip and table: "March 2026", "1 – 7 Sep 2026". */
  range: string;
  /** Experiences live during the bucket. */
  activeExperiences: number;
  /**
   * Distinct experiences that took at least one booking in the bucket —
   * the file's "Experiences Booked". Counting experiences rather than
   * bookings keeps both lines in one unit on one axis, so the gap between
   * them reads directly as inventory that didn't sell.
   */
  bookedExperiences: number;
};

export type HomeInsights = {
  funnel: Record<FunnelPeriod, FunnelFigures>;
  conversion: Record<ConversionGranularity, ConversionPoint[]>;
  isDemoData: boolean;
};
