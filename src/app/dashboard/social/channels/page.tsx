import { Link2, RefreshCw, Trash2 } from "lucide-react";

import { PlatformIcon } from "@/components/social/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status";
import { listChannels } from "@/lib/data/social";
import { statusForChannel } from "@/lib/status";
import {
  CHANNEL_STATUS_LABELS,
  PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  type ChannelCapabilities,
  type SocialChannel,
} from "@/lib/social/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Channels" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

/**
 * Connected accounts — the gateway for the whole Grow section.
 *
 * It leads with token health rather than with follower counts, because the
 * expensive failure here is silent: a Meta token lapses after 60 days, the
 * next scheduled post fails, and the operator finds out when a departure did
 * not fill. Expiry is shown as a date and a countdown, ahead of any vanity
 * number.
 */
export default async function ChannelsPage() {
  const { channels, isDemoData } = await listChannels();

  const connected = channels.filter((channel) => channel.status !== "disconnected");
  const available = SOCIAL_PLATFORMS.filter(
    (platform) => !connected.some((channel) => channel.platform === platform),
  );
  const needsAttention = connected.filter(
    (channel) => channel.status === "expiring" || channel.status === "needs_reauth",
  );

  return (
    <>
      <PageBar
        crumbs={[
          { label: "Growth" },
          { label: "SM Channels" },
        ]}
      />

      <div className="surface-card">
        <div className="card-scroll">
          {needsAttention.length > 0 ? (
            <Notice
              status={
                needsAttention.some((channel) => channel.status === "needs_reauth")
                  ? "critical"
                  : "warning"
              }
              title={
                needsAttention.length === 1
                  ? `${needsAttention[0].displayName} needs reconnecting`
                  : `${needsAttention.length} channels need reconnecting`
              }
              className="mb-[16px]"
            >
              Meta access tokens last 60 days and cannot be renewed once they
              lapse. Reconnect before the date below and nothing in your
              calendar is interrupted.
            </Notice>
          ) : null}

          <Panel
            title="Connected"
            hint={`${connected.length} of ${SOCIAL_PLATFORMS.length} platforms`}
          >
            <div className="panel-body">
              {connected.length === 0 ? (
                <p className="m-0 text-[12.5px] text-text-muted">
                  Nothing connected yet. Link a channel below to start
                  scheduling.
                </p>
              ) : (
                <div className="channel-grid">
                  {connected.map((channel) => (
                    <ConnectedCard key={channel.id} channel={channel} />
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {available.length > 0 ? (
            <Panel
              title="Available"
              hint="each one is another place a departure can fill from"
              className="mt-[16px]"
            >
              <div className="panel-body">
                <div className="channel-grid">
                  {available.map((platform) => (
                    <article
                      key={platform}
                      className="channel-card is-disconnected"
                      aria-label={PLATFORM_LABELS[platform]}
                    >
                      <div className="channel-card-head">
                        <span className="channel-mark">
                          <PlatformIcon platform={platform} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="channel-name m-0">{PLATFORM_LABELS[platform]}</p>
                          <p className="channel-handle m-0">Not connected</p>
                        </div>
                      </div>
                      <p className="m-0 field-hint">{CONNECT_COPY[platform]}</p>
                      <button
                        type="button"
                        disabled
                        title="Connecting needs the platform app review — see the roadmap"
                        className={cn(buttonClass({ variant: "primary" }), "mt-auto w-full justify-center")}
                      >
                        <Link2 aria-hidden />
                        Connect {PLATFORM_LABELS[platform]}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          {isDemoData ? (
            <p className="mt-[16px] field-hint">
              Sample channels. Connecting a real account needs the platform
              integration — the first milestone on the Grow roadmap.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

const CONNECT_COPY: Record<string, string> = {
  instagram:
    "Publish posts, carousels, reels and stories. Reach and engagement flow back into Performance.",
  facebook:
    "Publish to your page, and the only way to run ads across Meta from inside GoDND.",
  x: "Publish posts and threads. Useful for departure announcements and last-seat calls.",
};

function ConnectedCard({ channel }: { channel: SocialChannel }) {
  const status = statusForChannel(channel.status);
  const days = channel.expiresInDays;

  return (
    <article className="channel-card" aria-label={`${PLATFORM_LABELS[channel.platform]}, ${channel.handle}`}>
      <div className="channel-card-head">
        <span className="channel-mark">
          <PlatformIcon platform={channel.platform} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="channel-name m-0 truncate">{channel.displayName}</p>
          <p className="channel-handle m-0 truncate">@{channel.handle}</p>
        </div>
        <StatusBadge status={status} label={CHANNEL_STATUS_LABELS[channel.status]} />
      </div>

      <div className="channel-stat">
        <span className="channel-stat-val">
          {channel.followers.toLocaleString("en-IN")}
        </span>
        <span className="text-[11.5px] text-text-muted">followers</span>
        {channel.followersDelta !== 0 ? (
          <span
            className={cn(
              "text-[11.5px] font-medium",
              channel.followersDelta > 0 ? "text-healthy-fg" : "text-critical-fg",
            )}
          >
            {channel.followersDelta > 0 ? "+" : ""}
            {channel.followersDelta.toLocaleString("en-IN")}
          </span>
        ) : null}
        <span className="text-[11px] text-text-muted">30d</span>
      </div>

      <Capabilities capabilities={channel.capabilities} />

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[10px] gap-y-[3px] text-[11px]">
        <dt className="text-text-muted">Access until</dt>
        <dd
          className={cn(
            "m-0",
            status === "warning" && "font-medium text-warning-fg",
            status === "critical" && "font-medium text-critical-fg",
          )}
        >
          {channel.tokenExpiresAt ? formatDate(channel.tokenExpiresAt) : "—"}
          {days != null && days <= 14 ? (
            <> · {days <= 0 ? "expired" : `${days} day${days === 1 ? "" : "s"} left`}</>
          ) : null}
        </dd>
        <dt className="text-text-muted">Last synced</dt>
        <dd className="m-0 text-text-secondary">
          {channel.lastSyncedAt ? formatDate(channel.lastSyncedAt) : "Never"}
        </dd>
      </dl>

      <div className="mt-auto flex gap-[6px]">
        <button type="button" disabled className={cn(buttonClass({ size: "small" }), "flex-1 justify-center")}>
          <RefreshCw aria-hidden />
          Reconnect
        </button>
        <button
          type="button"
          disabled
          aria-label={`Disconnect ${channel.displayName}`}
          className={buttonClass({ size: "small", variant: "danger" })}
        >
          <Trash2 aria-hidden />
        </button>
      </div>
    </article>
  );
}

/**
 * What the granted scopes actually permit. Shown because "connected" is not
 * one thing: an Instagram account connected without the ads scope will still
 * publish perfectly and then fail the moment a campaign is created, and that
 * gap should be visible before the campaign, not after.
 */
function Capabilities({ capabilities }: { capabilities: ChannelCapabilities }) {
  const entries: [keyof ChannelCapabilities, string][] = [
    ["publish", "Publish"],
    ["stories", "Stories"],
    ["insights", "Insights"],
    ["ads", "Ads"],
  ];
  return (
    <ul className="channel-caps m-0 list-none p-0">
      {entries.map(([key, label]) => (
        <li key={key} className={cn("cap", !capabilities[key] && "off")}>
          {label}
        </li>
      ))}
    </ul>
  );
}
