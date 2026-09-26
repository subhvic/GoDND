/**
 * Social media management — domain types.
 *
 * Kept in its own module rather than lib/types.ts because this half of the
 * product talks to other people's systems. Everything here has a counterpart
 * in an Instagram, Facebook or X payload, and the names deliberately match
 * what those APIs call things, so a reader comparing the two does not have to
 * translate.
 */

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
};

/**
 * What can be published. These are not interchangeable: a reel is vertical
 * video, a story expires in 24 hours, a carousel takes up to 10 images. The
 * composer changes its rules per format, so it is a first-class field rather
 * than a tag on a generic "post".
 */
export const POST_FORMATS = ["post", "carousel", "story", "reel", "thread"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const FORMAT_LABELS: Record<PostFormat, string> = {
  post: "Post",
  carousel: "Carousel",
  story: "Story",
  reel: "Reel",
  thread: "Thread",
};

/** Which formats each platform actually accepts. The composer reads this. */
export const PLATFORM_FORMATS: Record<SocialPlatform, PostFormat[]> = {
  instagram: ["post", "carousel", "story", "reel"],
  facebook: ["post", "carousel", "story", "reel"],
  x: ["post", "thread"],
};

/**
 * Per-platform publishing rules. Deterministic, checkable before publish, and
 * the reason the composer can be useful before any AI is wired: most rejected
 * or under-performing posts break one of these, and the operator finds out
 * from the platform hours later rather than from us at the point of writing.
 *
 * `captionMax` is the platform's hard limit. `captionIdeal` is where the
 * caption is truncated behind a "more" link, which is what actually decides
 * whether the hook is read.
 */
export type PlatformRules = {
  captionMax: number;
  captionIdeal: number;
  hashtagMax: number;
  hashtagIdeal: number;
  /** Whether a bare URL in the body is clickable. */
  linksClickable: boolean;
  /** Aspect ratios the format wants, as width/height. */
  aspect: Record<string, number>;
};

export const PLATFORM_RULES: Record<SocialPlatform, PlatformRules> = {
  instagram: {
    captionMax: 2200,
    captionIdeal: 125,
    hashtagMax: 30,
    hashtagIdeal: 5,
    linksClickable: false,
    aspect: { post: 4 / 5, carousel: 4 / 5, story: 9 / 16, reel: 9 / 16 },
  },
  facebook: {
    captionMax: 63206,
    captionIdeal: 250,
    hashtagMax: 30,
    hashtagIdeal: 3,
    linksClickable: true,
    aspect: { post: 1.91, carousel: 1, story: 9 / 16, reel: 9 / 16 },
  },
  x: {
    captionMax: 280,
    captionIdeal: 280,
    hashtagMax: 10,
    hashtagIdeal: 2,
    linksClickable: true,
    aspect: { post: 16 / 9, thread: 16 / 9 },
  },
};

/* -------------------------------------------------------------------------- */
/* Channels                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A connection's health. `expiring` exists because Instagram and Facebook
 * long-lived tokens last 60 days: without a warning state, every operator
 * discovers the expiry as a failed post on the morning of a departure.
 */
export const CHANNEL_STATUSES = [
  "connected",
  "expiring",
  "needs_reauth",
  "disconnected",
] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  connected: "Connected",
  expiring: "Expiring soon",
  needs_reauth: "Reconnect needed",
  disconnected: "Not connected",
};

/** What a connection is permitted to do, from the scopes it was granted. */
export type ChannelCapabilities = {
  publish: boolean;
  stories: boolean;
  insights: boolean;
  ads: boolean;
};

export type SocialChannel = {
  id: string;
  platform: SocialPlatform;
  /** @handle, without the @. */
  handle: string;
  displayName: string;
  followers: number;
  /** Change over the last 30 days, in followers. */
  followersDelta: number;
  status: ChannelStatus;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  /**
   * Whole days until tokenExpiresAt, resolved when the record is read.
   * Computed here rather than in the view so that rendering stays pure and
   * every card on a page counts down from the same instant.
   */
  expiresInDays: number | null;
  lastSyncedAt: string | null;
  capabilities: ChannelCapabilities;
};

/* -------------------------------------------------------------------------- */
/* Posts                                                                       */
/* -------------------------------------------------------------------------- */

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

/** What a published post earned. Absent until the first metrics sync. */
export type PostMetrics = {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  linkClicks: number;
  profileVisits: number;
};

export type SocialPost = {
  id: string;
  /** Internal name, for the calendar and lists. Never published. */
  title: string;
  /** The caption as published. */
  body: string;
  format: PostFormat;
  /** A post can go to several channels at once; each gets its own result. */
  platforms: SocialPlatform[];
  /** The experience this promotes, when it came from one. */
  experienceId: string | null;
  experienceTitle: string | null;
  /** Photo ids from the experience's media (lib/experience-wizard/image-db). */
  imageIds: string[];
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  metrics: PostMetrics | null;
  /** Set when status is "failed" — the platform's reason, in its words. */
  failureReason: string | null;
};

/* -------------------------------------------------------------------------- */
/* Ads                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ads are run where operators already run them — Meta Ads Manager, Google Ads —
 * and read into GoDND, never created here. Two reasons this is the right shape:
 *
 *   1. Those campaign builders are better than anything we would write, and an
 *      operator's existing audiences and pixel history live there already.
 *   2. Reading insights needs a far lighter permission than managing campaigns
 *      (Meta: ads_read against ads_management; Google: a read-only developer
 *      token), which is weeks off the review and most of the risk.
 *
 * What GoDND adds is the half the ad platforms cannot see: which clicks became
 * bookings, and whether the departure being promoted still has seats.
 */
export const AD_PLATFORMS = ["meta", "google", "x"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: "Meta",
  google: "Google",
  x: "X",
};

/** A linked ad account, read-only. */
export type AdAccount = {
  id: string;
  platform: AdPlatform;
  /** The account name as the platform shows it. */
  name: string;
  /** The platform's own account reference, e.g. act_1029384756. */
  externalId: string;
  currency: string;
  status: "connected" | "needs_reauth" | "disconnected";
  lastSyncedAt: string | null;
};

export const CAMPAIGN_OBJECTIVES = ["awareness", "traffic", "bookings"] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  awareness: "Awareness",
  traffic: "Traffic",
  bookings: "Bookings",
};

/** Mirrors the platform's own states — GoDND has no say in these. */
export const CAMPAIGN_STATUSES = ["active", "paused", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

/**
 * Whether a campaign's clicks can be traced to bookings.
 *
 * This is the load-bearing field of the whole Ads screen. Spend and clicks
 * arrive from the platform whatever happens; "did it sell anything" only works
 * when the destination URL carries GoDND's tracking, and a campaign built in
 * Meta Ads Manager has no reason to. Untracked spend is not a rendering detail
 * to grey out — it is the single thing most worth telling the operator, because
 * every rupee of it is unmeasurable until they fix the link.
 *
 *   tracked     the link carries our parameters and points at this experience
 *   untracked   no tracking: spend is visible, bookings can never be attributed
 *   mismatched  tracked, but pointing at a different experience than the
 *               campaign claims — usually a copied campaign whose link was
 *               never updated, which silently credits the wrong trip
 */
export const TRACKING_STATES = ["tracked", "untracked", "mismatched"] as const;
export type TrackingState = (typeof TRACKING_STATES)[number];

export const TRACKING_LABELS: Record<TrackingState, string> = {
  tracked: "Tracked",
  untracked: "No tracking",
  mismatched: "Wrong link",
};

export type AdCampaign = {
  id: string;
  name: string;
  platform: AdPlatform;
  accountId: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  /** Which experience this promotes, resolved from the destination link. */
  experienceId: string | null;
  experienceTitle: string | null;
  tracking: TrackingState;
  /** Deep link back to the platform, since editing happens there. */
  permalink: string | null;
  currency: string;
  budgetMinor: number;
  spentMinor: number;
  startDate: string;
  endDate: string | null;
  reach: number;
  clicks: number;
  /** Bookings GoDND traced to this campaign. Null when it is not tracked. */
  attributedBookings: number | null;
  attributedRevenueMinor: number | null;
};

/** Click-through rate as a fraction, from the raw counts. */
export const campaignCtr = (campaign: AdCampaign) =>
  campaign.reach === 0 ? 0 : campaign.clicks / campaign.reach;

/**
 * Return on ad spend. Null covers two different unknowns that must not be
 * drawn as zero: nothing spent yet, and spend that cannot be attributed
 * because the campaign carries no tracking.
 */
export const campaignRoas = (campaign: AdCampaign) =>
  campaign.spentMinor === 0 || campaign.attributedRevenueMinor == null
    ? null
    : campaign.attributedRevenueMinor / campaign.spentMinor;

/** Cost per booking, or null when it cannot be known. */
export const campaignCostPerBooking = (campaign: AdCampaign) =>
  !campaign.attributedBookings ? null : campaign.spentMinor / campaign.attributedBookings;

/* -------------------------------------------------------------------------- */
/* Growth actions                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One recommendation, derived from the operator's own numbers.
 *
 * Every action names the evidence it came from. A recommendation an operator
 * cannot check is a horoscope, and they stop reading them.
 */
export type GrowthAction = {
  id: string;
  title: string;
  /** The reasoning, in one sentence, with the numbers in it. */
  evidence: string;
  severity: "critical" | "warning" | "info";
  /** Where acting on it starts. */
  href: string;
  actionLabel: string;
};
