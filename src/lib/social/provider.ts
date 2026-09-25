import "server-only";

import type {
  PostMetrics,
  SocialChannel,
  SocialPlatform,
  SocialPost,
} from "@/lib/social/types";

/**
 * The seam between GoDND and whoever actually talks to Instagram, Facebook
 * and X.
 *
 * This interface is the most important decision in the social module, and it
 * exists before any implementation on purpose. The question "aggregator or
 * direct platform APIs?" has a different answer at 10 operators than at 1,000,
 * and a different one again for ads than for organic posts. Every one of those
 * answers is a swap behind this interface rather than a rewrite of the product.
 *
 * What is deliberately NOT here:
 *
 *   - The calendar. Scheduling, drafts and the content itself live in GoDND's
 *     own tables. A vendor holding the schedule means a vendor holding the
 *     product hostage, and it means no calendar when their API is down.
 *   - Metrics history. Providers hand back a snapshot of "now"; the
 *     time series is ours, written to social_post_metrics on each sync.
 *     Instagram's own retention is shorter than an operator's memory.
 *
 * So a provider does three things and nothing else: connect an account,
 * publish a post, and read back numbers.
 *
 * Planned implementations, in the order they are worth building:
 *
 *   1. DemoProvider      — fixtures, no network. What ships today.
 *   2. AggregatorProvider — one vendor (Ayrshare / Phyllo / Late) covering all
 *      three platforms. They hold the Meta app review, which is the long pole;
 *      we pay per connected profile. Fastest route to a working product.
 *   3. MetaProvider / XProvider — direct Graph and X APIs. Cheaper per profile
 *      and the only way to reach the ads and deeper insights endpoints, at the
 *      cost of app review and maintaining each platform's quirks ourselves.
 *
 * Mixing is expected and fine: direct Meta for publishing and ads, an
 * aggregator for X, because X's API pricing changes more often than its logo.
 */
export interface SocialProvider {
  readonly id: string;

  /** Platforms this provider can actually serve. */
  supports(platform: SocialPlatform): boolean;

  /**
   * Step one of OAuth: where to send the operator. `state` is ours and must
   * come back untouched — it is what ties the callback to an agency.
   */
  connectUrl(input: {
    platform: SocialPlatform;
    agencyId: string;
    state: string;
    redirectUri: string;
  }): Promise<string>;

  /** Step two: trade the callback code for a stored, long-lived connection. */
  completeConnection(input: {
    platform: SocialPlatform;
    code: string;
    state: string;
  }): Promise<SocialChannel>;

  /**
   * Refresh before expiry rather than after failure. Meta's long-lived tokens
   * last 60 days and cannot be refreshed once they lapse — the operator has to
   * re-authorise by hand, which is a support ticket every time.
   */
  refresh(channelId: string): Promise<SocialChannel>;

  disconnect(channelId: string): Promise<void>;

  /**
   * Publish to one channel. Deliberately one channel at a time: a post going
   * to Instagram and X can succeed on one and fail on the other, and the
   * operator needs to know which, so partial failure is modelled as separate
   * calls rather than hidden inside a batch.
   */
  publish(input: {
    channelId: string;
    post: SocialPost;
    /** Signed, publicly reachable URLs — platforms fetch media themselves. */
    mediaUrls: string[];
  }): Promise<{ externalId: string; permalink: string | null }>;

  /** Current numbers for one published post. The history is ours to keep. */
  fetchMetrics(input: {
    channelId: string;
    externalId: string;
  }): Promise<PostMetrics>;

  /** Follower count and profile-level numbers, for the channel cards. */
  fetchChannel(channelId: string): Promise<SocialChannel>;
}
