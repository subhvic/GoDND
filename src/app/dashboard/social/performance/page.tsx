import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";

import { PlatformIcon } from "@/components/social/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import {
  deriveActions,
  listCampaigns,
  listChannels,
  listPosts,
  summarise,
} from "@/lib/data/social";
import {
  FORMAT_LABELS,
  type GrowthAction,
  type SocialPost,
} from "@/lib/social/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Performance" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

/**
 * What the posting is earning, and what to do about it.
 *
 * The actions sit above the numbers on purpose. An operator running trips does
 * not open this page to browse a dashboard; they open it to find out whether
 * anything needs them. Numbers that produced no action are still here,
 * underneath, so any recommendation can be checked against them.
 */
export default async function PerformancePage() {
  const [{ channels }, { posts }, { campaigns }] = await Promise.all([
    listChannels(),
    listPosts(),
    listCampaigns(),
  ]);

  const summary = summarise(channels, posts);
  const actions = deriveActions(channels, posts, campaigns);

  const published = posts
    .filter((post) => post.status === "published" && post.metrics)
    .sort((a, b) => b.metrics!.reach - a.metrics!.reach);

  const reachDelta =
    summary.reachPrevious === 0
      ? 0
      : (summary.reach - summary.reachPrevious) / summary.reachPrevious;
  const clicksDelta =
    summary.linkClicksPrevious === 0
      ? 0
      : (summary.linkClicks - summary.linkClicksPrevious) / summary.linkClicksPrevious;

  return (
    <>
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Performance" }]}
      />

      <div className="surface-card">
        <div className="card-scroll">
          <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            <KpiCard
              label="Reach"
              value={summary.reach.toLocaleString("en-IN")}
              status={reachDelta >= 0 ? "healthy" : "warning"}
              comparison={`${signed(reachDelta)} vs previous 30 days`}
              trend={summary.trend}
            />
            <KpiCard
              label="Engagement rate"
              value={(summary.engagementRate * 100).toFixed(1)}
              unit="%"
              status={summary.engagementRate >= 0.03 ? "healthy" : "warning"}
              comparison={
                summary.engagementRate >= 0.03
                  ? "above the 3% travel benchmark"
                  : "below the 3% travel benchmark"
              }
            />
            <KpiCard
              label="Link clicks"
              value={summary.linkClicks.toLocaleString("en-IN")}
              status={clicksDelta >= 0 ? "healthy" : "warning"}
              comparison={`${signed(clicksDelta)} vs previous 30 days`}
            />
            <KpiCard
              label="Followers"
              value={summary.followers.toLocaleString("en-IN")}
              status={summary.followersDelta >= 0 ? "healthy" : "warning"}
              comparison={`${summary.followersDelta >= 0 ? "+" : ""}${summary.followersDelta.toLocaleString("en-IN")} in 30 days`}
            />
          </div>

          <Panel
            title="What to do next"
            hint="derived from the numbers below"
            className="mt-[16px]"
          >
            <div className="panel-body">
              {actions.length === 0 ? (
                <p className="m-0 text-[12.5px] text-text-muted">
                  Nothing needs attention. Channels are healthy and every
                  scheduled post went out.
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {actions.map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel
            title="Published posts"
            hint="best reach first"
            className="mt-[16px]"
          >
            <div className="overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <caption className="sr-only">Published posts by reach</caption>
                <thead>
                  <tr>
                    <th scope="col">Post</th>
                    <th scope="col" className="left">Format</th>
                    <th scope="col">Published</th>
                    <th scope="col">Reach</th>
                    <th scope="col">Engagement</th>
                    <th scope="col">Link clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {published.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={6}>
                        <EmptyState
                          icon={TrendingUp}
                          title="Nothing published yet"
                          description="Numbers appear here the day after your first post goes out."
                          action={
                            <Link href="/dashboard/social/studio" className={buttonClass({ variant: "primary" })}>
                              Open Studio
                            </Link>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    published.map((post) => <PostRow key={post.id} post={post} />)
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

const signed = (fraction: number) =>
  `${fraction >= 0 ? "+" : ""}${(fraction * 100).toFixed(0)}%`;

function ActionRow({ action }: { action: GrowthAction }) {
  return (
    <li className="action-row">
      <span aria-hidden className={cn("action-dot", action.severity)} />
      <div className="min-w-0 flex-1">
        <p className="action-title m-0">{action.title}</p>
        <p className="action-evidence m-0">{action.evidence}</p>
      </div>
      <Link href={action.href} className={cn(buttonClass({ size: "small" }), "shrink-0")}>
        {action.actionLabel}
        <ArrowRight aria-hidden />
      </Link>
    </li>
  );
}

function PostRow({ post }: { post: SocialPost }) {
  const m = post.metrics!;
  const engagements = m.likes + m.comments + m.shares + m.saves;
  const rate = m.reach === 0 ? 0 : engagements / m.reach;

  return (
    <tr>
      <th scope="row" className="max-w-[300px]">
        <span className="row-name">
          <span className="flex shrink-0 gap-[3px] text-text-muted">
            {post.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="size-[13px]" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-text-primary">
              {post.title}
            </span>
            {post.experienceTitle ? (
              <span className="block truncate text-[10.5px] text-text-muted">
                {post.experienceTitle}
              </span>
            ) : null}
          </span>
        </span>
      </th>
      <td className="left">{FORMAT_LABELS[post.format]}</td>
      <td>{formatDate(post.publishedAt)}</td>
      <td className="primary font-medium">{m.reach.toLocaleString("en-IN")}</td>
      <td>
        {(rate * 100).toFixed(1)}%
        <span className="ml-[4px] text-[10.5px] text-text-muted">
          ({engagements.toLocaleString("en-IN")})
        </span>
      </td>
      <td>{m.linkClicks.toLocaleString("en-IN")}</td>
    </tr>
  );
}
