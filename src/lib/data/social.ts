import "server-only";

import {
  campaignRoas,
  FORMAT_LABELS,
  type PostFormat,
  type AdCampaign,
  type GrowthAction,
  type PostMetrics,
  type SocialChannel,
  type SocialPost,
} from "@/lib/social/types";

/**
 * Data access for the social module. Same shape as lib/data/experiences.ts:
 * the fixtures below are used only when Supabase is not configured, never as a
 * fallback for a query that failed.
 *
 * The fixture set is written as one operator's month, not as a spread of every
 * state: a connected Instagram, a Facebook page whose token is about to lapse,
 * an X account never connected. That is what a real workspace looks like, and
 * it is the state the screens have to read well in.
 */

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fixture dates are relative to today, so the calendar is populated whenever
 * the portal is opened rather than only in the month these were written.
 */
function dayOffset(days: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/* -------------------------------------------------------------------------- */
/* Channels                                                                    */
/* -------------------------------------------------------------------------- */

/** Fixture channels, before the read-time countdown is filled in. */
const DEMO_CHANNELS: Omit<SocialChannel, "expiresInDays">[] = [
  {
    id: "ch-ig",
    platform: "instagram",
    handle: "wanderbeyond.ne",
    displayName: "Wander Beyond",
    followers: 8420,
    followersDelta: 312,
    status: "connected",
    connectedAt: dayOffset(-84),
    tokenExpiresAt: dayOffset(38),
    lastSyncedAt: dayOffset(0, 7, 15),
    capabilities: { publish: true, stories: true, insights: true, ads: false },
  },
  {
    id: "ch-fb",
    platform: "facebook",
    handle: "wanderbeyondne",
    displayName: "Wander Beyond Travel",
    followers: 3150,
    followersDelta: -24,
    status: "expiring",
    connectedAt: dayOffset(-56),
    tokenExpiresAt: dayOffset(4),
    lastSyncedAt: dayOffset(0, 7, 15),
    capabilities: { publish: true, stories: true, insights: true, ads: true },
  },
  {
    id: "ch-x",
    platform: "x",
    handle: "",
    displayName: "",
    followers: 0,
    followersDelta: 0,
    status: "disconnected",
    connectedAt: null,
    tokenExpiresAt: null,
    lastSyncedAt: null,
    capabilities: { publish: false, stories: false, insights: false, ads: false },
  },
];

/** Resolves the stored expiry into the countdown the cards render. */
function withCountdown(
  channel: Omit<SocialChannel, "expiresInDays">,
  now: number,
): SocialChannel {
  return {
    ...channel,
    expiresInDays:
      channel.tokenExpiresAt == null
        ? null
        : Math.round((new Date(channel.tokenExpiresAt).getTime() - now) / 86_400_000),
  };
}

export async function listChannels(): Promise<{
  channels: SocialChannel[];
  isDemoData: boolean;
}> {
  const now = Date.now();
  if (!isSupabaseConfigured()) {
    return {
      channels: DEMO_CHANNELS.map((channel) => withCountdown(channel, now)),
      isDemoData: true,
    };
  }
  // Real implementation reads agency_social_channels under RLS, then asks the
  // provider to refresh anything whose token is near expiry.
  return { channels: [], isDemoData: false };
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                       */
/* -------------------------------------------------------------------------- */

const metrics = (
  reach: number,
  engagementRate: number,
  linkClicks: number,
): PostMetrics => {
  const engagements = Math.round(reach * engagementRate);
  return {
    reach,
    impressions: Math.round(reach * 1.34),
    likes: Math.round(engagements * 0.78),
    comments: Math.round(engagements * 0.07),
    shares: Math.round(engagements * 0.06),
    saves: Math.round(engagements * 0.09),
    linkClicks,
    profileVisits: Math.round(linkClicks * 2.6),
  };
};

const DEMO_POSTS: SocialPost[] = [
  /* --- Published, with numbers ------------------------------------------- */
  {
    id: "post-1",
    title: "Living root bridge — reel",
    body: "Nobody builds these. They're grown.\n\nThe Umshiang double-decker takes two generations of Khasi families to train into place — and you cross it on day four of our Meghalaya week.\n\nFull itinerary in bio.\n\n#meghalaya #livingrootbridges #northeastindia #slowtravel #khasihills",
    format: "reel",
    platforms: ["instagram"],
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    imageIds: [],
    status: "published",
    scheduledAt: dayOffset(-12, 18, 30),
    publishedAt: dayOffset(-12, 18, 30),
    metrics: metrics(14200, 0.082, 410),
    failureReason: null,
  },
  {
    id: "post-2",
    title: "Dawki river carousel",
    body: "The water is not edited.\n\nDawki's Umngot river runs clear enough to see the riverbed six metres down — best between November and February, which is exactly when we run it.\n\n#dawki #umngot #meghalaya #northeastindia",
    format: "carousel",
    platforms: ["instagram", "facebook"],
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    imageIds: [],
    status: "published",
    scheduledAt: dayOffset(-8, 9, 0),
    publishedAt: dayOffset(-8, 9, 0),
    metrics: metrics(5300, 0.041, 96),
    failureReason: null,
  },
  {
    id: "post-3",
    title: "Arunachal cycling — announcement",
    body: "Four days, three nights, one mountain road that nobody posts about.\n\nOur Arunachal cycling expedition opens for April departures today. Eight seats.\n\n#arunachalpradesh #cycletouring #northeastindia",
    format: "post",
    platforms: ["instagram", "facebook"],
    experienceId: "exp-2",
    experienceTitle: "Cycling & Camping Expedition in Arunachal",
    imageIds: [],
    status: "published",
    scheduledAt: dayOffset(-5, 11, 0),
    publishedAt: dayOffset(-5, 11, 0),
    metrics: metrics(3900, 0.035, 128),
    failureReason: null,
  },
  {
    id: "post-4",
    title: "Guest story — Assam rafting",
    body: "Priya sent us this from the Upper Assam trip. Swipe for the stretch of the Brahmaputra nobody expects.",
    format: "story",
    platforms: ["instagram"],
    experienceId: "exp-3",
    experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
    imageIds: [],
    status: "published",
    scheduledAt: dayOffset(-3, 16, 0),
    publishedAt: dayOffset(-3, 16, 0),
    metrics: metrics(2100, 0.028, 44),
    failureReason: null,
  },

  {
    id: "post-11",
    title: "Sunrise over Umiam — reel",
    body: "The lake is twenty minutes from Shillong and nobody is there at 5am.\n\nDay one of the Meghalaya week starts here, before the town wakes up.\n\n#shillong #umiamlake #meghalaya #northeastindia #sunrise",
    format: "reel",
    platforms: ["instagram"],
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    imageIds: [],
    status: "published",
    scheduledAt: dayOffset(-19, 19, 0),
    publishedAt: dayOffset(-19, 19, 0),
    metrics: metrics(9800, 0.071, 286),
    failureReason: null,
  },

  /* --- Failed, because the Facebook token lapsed -------------------------- */
  {
    id: "post-5",
    title: "Monsoon departures reminder",
    body: "Monsoon in the Khasi hills is not a problem to plan around. It is the reason to come.\n\nJune departures are open.",
    format: "post",
    platforms: ["facebook"],
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    imageIds: [],
    status: "failed",
    scheduledAt: dayOffset(-2, 10, 0),
    publishedAt: null,
    metrics: null,
    failureReason:
      "Facebook rejected the request: the access token has expired. Reconnect the page and retry.",
  },

  /* --- Scheduled ---------------------------------------------------------- */
  {
    id: "post-6",
    title: "Nongriat trek — reel",
    body: "3,500 steps down. The same 3,500 back up.\n\nNongriat is the hardest day of the Meghalaya week and the one every guest talks about afterwards.\n\n#nongriat #meghalaya #trekking #northeastindia",
    format: "reel",
    platforms: ["instagram"],
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    imageIds: [],
    status: "scheduled",
    scheduledAt: dayOffset(1, 18, 30),
    publishedAt: null,
    metrics: null,
    failureReason: null,
  },
  {
    id: "post-7",
    title: "Assam tea estate — carousel",
    body: "Second flush, picked the morning you arrive.\n\nThe Upper Assam trip stays two nights on a working estate outside Jorhat.\n\n#assam #teaestate #jorhat #northeastindia",
    format: "carousel",
    platforms: ["instagram", "facebook"],
    experienceId: "exp-3",
    experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
    imageIds: [],
    status: "scheduled",
    scheduledAt: dayOffset(3, 9, 30),
    publishedAt: null,
    metrics: null,
    failureReason: null,
  },
  {
    id: "post-8",
    title: "Seats left — Arunachal April",
    body: "Three seats left on the April 2 departure.",
    format: "story",
    platforms: ["instagram"],
    experienceId: "exp-2",
    experienceTitle: "Cycling & Camping Expedition in Arunachal",
    imageIds: [],
    status: "scheduled",
    scheduledAt: dayOffset(4, 12, 0),
    publishedAt: null,
    metrics: null,
    failureReason: null,
  },
  {
    id: "post-9",
    title: "Why we cap groups at eight",
    body: "Eight is the largest group a single Khasi homestay can feed at one sitting. That is the whole reason, and it is not a marketing line.",
    format: "post",
    platforms: ["instagram", "facebook"],
    experienceId: null,
    experienceTitle: null,
    imageIds: [],
    status: "scheduled",
    scheduledAt: dayOffset(7, 11, 0),
    publishedAt: null,
    metrics: null,
    failureReason: null,
  },

  /* --- Drafts ------------------------------------------------------------- */
  {
    id: "post-10",
    title: "Raw Meghalaya — 3 day teaser",
    body: "A shorter way in: three days, two nights, the Khasi hills without the trek.",
    format: "post",
    platforms: ["instagram"],
    experienceId: "exp-4",
    experienceTitle: "Raw Experience in Meghalaya",
    imageIds: [],
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    metrics: null,
    failureReason: null,
  },
];

export type PostQuery = {
  from?: string;
  to?: string;
};

export async function listPosts(query: PostQuery = {}): Promise<{
  posts: SocialPost[];
  isDemoData: boolean;
}> {
  if (!isSupabaseConfigured()) {
    const posts = DEMO_POSTS.filter((post) => {
      const at = post.scheduledAt ?? post.publishedAt;
      if (!at) return true;
      if (query.from && at < query.from) return false;
      if (query.to && at > query.to) return false;
      return true;
    });
    return { posts, isDemoData: true };
  }
  return { posts: [], isDemoData: false };
}

export async function getPost(id: string): Promise<SocialPost | null> {
  if (!isSupabaseConfigured()) {
    return DEMO_POSTS.find((post) => post.id === id) ?? null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                   */
/* -------------------------------------------------------------------------- */

const DEMO_CAMPAIGNS: AdCampaign[] = [
  {
    id: "camp-1",
    name: "Meghalaya week — April departures",
    platforms: ["instagram", "facebook"],
    objective: "bookings",
    status: "active",
    experienceId: "exp-1",
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    currency: "INR",
    budgetMinor: 4000000,
    spentMinor: 2637000,
    startDate: dayOffset(-18),
    endDate: dayOffset(12),
    reach: 96400,
    clicks: 3180,
    attributedBookings: 11,
    attributedRevenueMinor: 73700000,
  },
  {
    id: "camp-2",
    name: "Arunachal cycling — cold audience",
    platforms: ["facebook"],
    objective: "traffic",
    status: "active",
    experienceId: "exp-2",
    experienceTitle: "Cycling & Camping Expedition in Arunachal",
    currency: "INR",
    budgetMinor: 1500000,
    spentMinor: 1382000,
    startDate: dayOffset(-24),
    endDate: dayOffset(2),
    reach: 71200,
    clicks: 986,
    attributedBookings: 1,
    attributedRevenueMinor: 2450000,
  },
  {
    id: "camp-3",
    name: "Brand awareness — Northeast",
    platforms: ["instagram"],
    objective: "awareness",
    status: "paused",
    experienceId: null,
    experienceTitle: null,
    currency: "INR",
    budgetMinor: 1000000,
    spentMinor: 612000,
    startDate: dayOffset(-40),
    endDate: dayOffset(-10),
    reach: 48900,
    clicks: 412,
    attributedBookings: 0,
    attributedRevenueMinor: 0,
  },
  {
    id: "camp-4",
    name: "Assam tea estate — retargeting",
    platforms: ["instagram", "facebook"],
    objective: "bookings",
    status: "draft",
    experienceId: "exp-3",
    experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
    currency: "INR",
    budgetMinor: 2000000,
    spentMinor: 0,
    startDate: dayOffset(3),
    endDate: dayOffset(33),
    reach: 0,
    clicks: 0,
    attributedBookings: 0,
    attributedRevenueMinor: 0,
  },
];

export async function listCampaigns(): Promise<{
  campaigns: AdCampaign[];
  isDemoData: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { campaigns: DEMO_CAMPAIGNS, isDemoData: true };
  }
  return { campaigns: [], isDemoData: false };
}

/* -------------------------------------------------------------------------- */
/* Growth actions                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Derived, not authored. Each rule reads the same numbers the operator can see
 * on the Performance page, so an action can always be checked against the
 * table underneath it. When these move to the server they stay derivations —
 * the moment they become a hand-written list, they stop tracking reality.
 */
export function deriveActions(
  channels: SocialChannel[],
  posts: SocialPost[],
  campaigns: AdCampaign[],
): GrowthAction[] {
  const actions: GrowthAction[] = [];

  /* Connection problems first: nothing else works while a token is dead. */
  for (const channel of channels) {
    if (channel.status === "needs_reauth") {
      actions.push({
        id: `reauth-${channel.id}`,
        title: `Reconnect ${channel.displayName}`,
        evidence: "Its access token has expired, so scheduled posts to it will fail.",
        severity: "critical",
        href: "/dashboard/social/channels",
        actionLabel: "Reconnect",
      });
    } else if (channel.status === "expiring" && channel.expiresInDays != null) {
      const days = Math.max(0, channel.expiresInDays);
      actions.push({
        id: `expiring-${channel.id}`,
        title: `${channel.displayName} needs reconnecting within ${days} day${days === 1 ? "" : "s"}`,
        evidence:
          "Meta tokens cannot be renewed after they lapse — reconnecting now avoids re-authorising by hand later.",
        severity: "warning",
        href: "/dashboard/social/channels",
        actionLabel: "Reconnect",
      });
    }
  }

  const failed = posts.filter((post) => post.status === "failed");
  if (failed.length > 0) {
    actions.push({
      id: "failed-posts",
      title: `${failed.length} post${failed.length === 1 ? "" : "s"} failed to publish`,
      evidence: failed[0].failureReason ?? "The platform rejected the request.",
      severity: "critical",
      href: "/dashboard/social/calendar?status=failed",
      actionLabel: "Review",
    });
  }

  /* Format performance: the highest-value organic finding, and one an
     operator cannot see without the comparison being made for them. */
  const published = posts.filter((post) => post.status === "published" && post.metrics);
  const byFormat = new Map<string, { reach: number; count: number }>();
  for (const post of published) {
    const entry = byFormat.get(post.format) ?? { reach: 0, count: 0 };
    entry.reach += post.metrics!.reach;
    entry.count += 1;
    byFormat.set(post.format, entry);
  }
  const averages = [...byFormat.entries()]
    .map(([format, entry]) => ({ format, average: entry.reach / entry.count, count: entry.count }))
    .sort((a, b) => b.average - a.average);

  if (averages.length >= 2) {
    const best = averages[0];
    const rest = averages.slice(1);
    const restAverage =
      rest.reduce((sum, item) => sum + item.average, 0) / rest.length;
    const multiple = restAverage === 0 ? 0 : best.average / restAverage;
    // Two posts is a thin sample, but one is not a sample at all: a single
    // lucky post would otherwise be reported as a reliable multiple.
    if (multiple >= 1.5 && best.count >= 2) {
      const label = FORMAT_LABELS[best.format as PostFormat] ?? best.format;
      actions.push({
        id: "format-mix",
        title: `${label}s reach ${multiple.toFixed(1)}× what your other formats do`,
        evidence: `${Math.round(best.average).toLocaleString("en-IN")} average reach across ${best.count} ${label.toLowerCase()}s, against ${Math.round(restAverage).toLocaleString("en-IN")} for everything else.`,
        severity: "info",
        href: "/dashboard/social/studio",
        actionLabel: `Draft a ${label.toLowerCase()}`,
      });
    }
  }

  /* Ad spend with nothing to show for it. */
  for (const campaign of campaigns) {
    if (campaign.status !== "active") continue;
    const roas = campaignRoas(campaign);
    if (roas !== null && roas < 1 && campaign.spentMinor > 500000) {
      actions.push({
        id: `roas-${campaign.id}`,
        title: `"${campaign.name}" is spending more than it returns`,
        evidence: `₹${Math.round(campaign.spentMinor / 100).toLocaleString("en-IN")} spent, ₹${Math.round(campaign.attributedRevenueMinor / 100).toLocaleString("en-IN")} attributed across ${campaign.attributedBookings} booking${campaign.attributedBookings === 1 ? "" : "s"}.`,
        severity: "warning",
        href: "/dashboard/social/ads",
        actionLabel: "Review campaign",
      });
    }
  }

  const disconnected = channels.filter((channel) => channel.status === "disconnected");
  if (disconnected.length > 0) {
    actions.push({
      id: "connect-more",
      title: `${disconnected.length} channel${disconnected.length === 1 ? "" : "s"} not connected`,
      evidence:
        "Each connected channel is another place a departure can fill from, at no extra cost per post.",
      severity: "info",
      href: "/dashboard/social/channels",
      actionLabel: "Connect",
    });
  }

  return actions;
}

/* -------------------------------------------------------------------------- */
/* Aggregates                                                                  */
/* -------------------------------------------------------------------------- */

export type SocialSummary = {
  reach: number;
  reachPrevious: number;
  engagementRate: number;
  linkClicks: number;
  linkClicksPrevious: number;
  followers: number;
  followersDelta: number;
  scheduledCount: number;
  trend: number[];
};

export function summarise(
  channels: SocialChannel[],
  posts: SocialPost[],
): SocialSummary {
  const published = posts.filter((post) => post.status === "published" && post.metrics);
  const reach = published.reduce((sum, post) => sum + post.metrics!.reach, 0);
  const engagements = published.reduce((sum, post) => {
    const m = post.metrics!;
    return sum + m.likes + m.comments + m.shares + m.saves;
  }, 0);
  const linkClicks = published.reduce((sum, post) => sum + post.metrics!.linkClicks, 0);

  return {
    reach,
    // Fixtures carry no prior window; the real query reads the previous 30 days.
    reachPrevious: Math.round(reach * 0.78),
    engagementRate: reach === 0 ? 0 : engagements / reach,
    linkClicks,
    linkClicksPrevious: Math.round(linkClicks * 1.12),
    followers: channels.reduce((sum, channel) => sum + channel.followers, 0),
    followersDelta: channels.reduce((sum, channel) => sum + channel.followersDelta, 0),
    scheduledCount: posts.filter((post) => post.status === "scheduled").length,
    trend: [820, 1140, 980, 1620, 2310, 1890, 3120, 2740, 4100, 3860, 5200, 4780],
  };
}
