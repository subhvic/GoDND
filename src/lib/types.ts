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
   Enquiries
   ========================================================================== */

/**
 * The seven pipeline stages from the schema (enquiry_status). The operator
 * moves an enquiry through them by hand, except new → open, which the
 * bump_enquiry_activity trigger does on the first agent reply.
 */
export const ENQUIRY_STATUSES = [
  "new",
  "open",
  "quoted",
  "negotiating",
  "won",
  "lost",
  "spam",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  open: "Open",
  quoted: "Quoted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
};

/** One line under each stage in the stage menu, so the choice is obvious. */
export const ENQUIRY_STATUS_HINTS: Record<EnquiryStatus, string> = {
  new: "Nobody has replied yet",
  open: "In conversation",
  quoted: "A price has been sent",
  negotiating: "Working out dates or price",
  won: "Became a booking",
  lost: "Went elsewhere or went quiet",
  spam: "Not a real enquiry",
};

/** Stages that end the conversation's pipeline — they live under Closed. */
export const CLOSED_ENQUIRY_STATUSES: EnquiryStatus[] = ["won", "lost", "spam"];

export type EnquirySource =
  | "marketplace"
  | "website"
  | "manual"
  | "whatsapp"
  | "phone"
  | "referral";

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  marketplace: "GoDND marketplace",
  website: "Your website",
  manual: "Logged by your team",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  referral: "Referral",
};

export type EnquiryPriority = "low" | "normal" | "high";

/**
 * The inbox is split by whose move it is, not by pipeline stage: the one
 * question an operator opens Enquiries to answer is "who is waiting on me?".
 * The three views are disjoint, so the counts add up to the whole inbox.
 */
export const ENQUIRY_VIEWS = [
  { key: "needs_reply", label: "Needs reply" },
  { key: "replied", label: "Replied" },
  { key: "closed", label: "Closed" },
] as const;

export type EnquiryViewKey = (typeof ENQUIRY_VIEWS)[number]["key"];

export const LOST_REASONS = [
  "Price too high",
  "Dates not available",
  "Booked with someone else",
  "Stopped replying",
  "Changed their plans",
] as const;

/** A priced offer, sent in the thread as a structured attachment. */
export type EnquiryQuote = {
  kind: "quote";
  experienceId: string | null;
  experienceTitle: string;
  startDate: string | null;
  adults: number;
  children: number;
  infants: number;
  totalMinor: number;
  currency: string;
  validUntil: string | null;
  note: string | null;
};

export type EnquiryAttachment =
  | { kind: "image"; url: string; name: string }
  | {
      kind: "file";
      url: string;
      name: string;
      sizeBytes: number | null;
      mimeType: string | null;
    }
  | EnquiryQuote;

export type EnquirySenderKind = "traveller" | "agent" | "system";

export type EnquiryMessage = {
  id: string;
  senderKind: EnquirySenderKind;
  senderId: string | null;
  /** Resolved for display; null for system events. */
  senderName: string | null;
  body: string | null;
  attachments: EnquiryAttachment[];
  /** Team-only note. Never shown to the traveller (enforced by RLS). */
  isInternal: boolean;
  /** Agent messages: when the traveller read it. Traveller messages: when the team did. */
  readAt: string | null;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  isYou?: boolean;
};

/** The last public message, as the inbox list previews it. */
export type EnquiryPreview = {
  body: string | null;
  senderKind: "traveller" | "agent";
  senderId: string | null;
  senderName: string | null;
  createdAt: string;
  attachmentKind: EnquiryAttachment["kind"] | null;
};

/** A row in the inbox list. */
export type EnquiryRow = {
  id: string;
  reference: string;              // ENQ-000142
  status: EnquiryStatus;
  priority: EnquiryPriority;
  source: EnquirySource;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  /** True when the traveller has a GoDND account and sees replies in-app. */
  hasAccount: boolean;
  experienceId: string | null;
  experienceTitle: string | null;
  adults: number;
  children: number;
  infants: number;
  preferredStart: string | null;
  flexibleDates: boolean;
  budgetMinor: number | null;
  currency: string;
  /** What they wrote on the enquiry form. */
  message: string | null;
  assignee: TeamMember | null;
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  lastMessage: EnquiryPreview | null;
  /**
   * When the operator's turn started — the first traveller message after the
   * last reply, or the enquiry itself if nobody has replied. Null when the
   * ball is in the traveller's court.
   */
  awaitingReplySince: string | null;
};

export type EnquiryDetail = EnquiryRow & {
  lostReason: string | null;
  /** Chronological, oldest first. Includes internal notes and system events. */
  messages: EnquiryMessage[];
  booking: { id: string; reference: string } | null;
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
