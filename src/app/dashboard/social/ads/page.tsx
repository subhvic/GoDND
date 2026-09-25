import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";

import { PlatformIcon } from "@/components/social/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import { listCampaigns, listChannels } from "@/lib/data/social";
import { statusForCampaign } from "@/lib/status";
import {
  campaignCtr,
  campaignRoas,
  CAMPAIGN_STATUS_LABELS,
  OBJECTIVE_LABELS,
  type AdCampaign,
} from "@/lib/social/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Ads" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

/**
 * Paid campaigns across Meta and X.
 *
 * Return on ad spend leads every row, because it is the only number that
 * settles whether a campaign should continue, and it is the one an operator
 * cannot get from the platforms' own dashboards: those know the click, GoDND
 * knows the booking it turned into.
 */
export default async function AdsPage() {
  const [{ campaigns }, { channels }] = await Promise.all([
    listCampaigns(),
    listChannels(),
  ]);

  const live = campaigns.filter((campaign) => campaign.status === "active");
  const spent = campaigns.reduce((sum, campaign) => sum + campaign.spentMinor, 0);
  const revenue = campaigns.reduce(
    (sum, campaign) => sum + campaign.attributedRevenueMinor,
    0,
  );
  const bookings = campaigns.reduce(
    (sum, campaign) => sum + campaign.attributedBookings,
    0,
  );
  const blendedRoas = spent === 0 ? null : revenue / spent;

  const adsCapable = channels.some((channel) => channel.capabilities.ads);

  return (
    <>
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Ads" }]}
        actions={
          <button type="button" disabled className={buttonClass({ variant: "primary" })}>
            <Plus aria-hidden />
            <span className="hidden sm:inline">New campaign</span>
            <span className="sm:hidden">New</span>
          </button>
        }
      />

      <div className="surface-card">
        <div className="card-scroll">
          {!adsCapable ? (
            <Notice
              status="warning"
              title="No channel can run ads yet"
              className="mb-[16px]"
            >
              Ads run through a Meta ad account linked to a connected Facebook
              page. Connect one on{" "}
              <Link href="/dashboard/social/channels" className="text-brand hover:underline">
                Channels
              </Link>{" "}
              to create a campaign.
            </Notice>
          ) : null}

          <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            <KpiCard
              label="Spend"
              value={formatMoney(spent)}
              status="neutral"
              comparison={`across ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}, ${live.length} live`}
            />
            <KpiCard
              label="Return on ad spend"
              value={blendedRoas == null ? "—" : `${blendedRoas.toFixed(1)}×`}
              status={blendedRoas == null ? "neutral" : blendedRoas >= 2 ? "healthy" : "warning"}
              comparison={
                blendedRoas == null
                  ? "nothing spent yet"
                  : `${formatMoney(revenue)} attributed revenue`
              }
            />
            <KpiCard
              label="Attributed bookings"
              value={String(bookings)}
              status={bookings > 0 ? "healthy" : "neutral"}
              comparison={
                bookings === 0
                  ? "no bookings traced to ads yet"
                  : `${formatMoney(Math.round(spent / bookings))} cost per booking`
              }
            />
            <KpiCard
              label="Reach"
              value={campaigns
                .reduce((sum, campaign) => sum + campaign.reach, 0)
                .toLocaleString("en-IN")}
              status="neutral"
              comparison="people reached by paid placements"
            />
          </div>

          <Panel title="Campaigns" className="mt-[16px]">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[940px]">
                <caption className="sr-only">Ad campaigns</caption>
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col" className="left">Objective</th>
                    <th scope="col" className="left">Runs</th>
                    <th scope="col">Budget</th>
                    <th scope="col">Spent</th>
                    <th scope="col">CTR</th>
                    <th scope="col">Bookings</th>
                    <th scope="col">ROAS</th>
                    <th scope="col" className="left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={9}>
                        <EmptyState
                          icon={Megaphone}
                          title="No campaigns yet"
                          description="A campaign promotes one experience to an audience you choose, and reports the bookings it produced."
                        />
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} />
                    ))
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

function CampaignRow({ campaign }: { campaign: AdCampaign }) {
  const roas = campaignRoas(campaign);
  const spentFraction =
    campaign.budgetMinor === 0 ? 0 : campaign.spentMinor / campaign.budgetMinor;
  const meterStatus =
    spentFraction >= 0.95 ? "critical" : spentFraction >= 0.8 ? "warning" : "";

  return (
    <tr>
      <th scope="row" className="max-w-[280px]">
        <span className="row-name">
          <span className="flex shrink-0 gap-[3px] text-text-muted">
            {campaign.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="size-[13px]" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-text-primary">
              {campaign.name}
            </span>
            {campaign.experienceTitle ? (
              <span className="block truncate text-[10.5px] text-text-muted">
                {campaign.experienceTitle}
              </span>
            ) : null}
          </span>
        </span>
      </th>
      <td className="left">{OBJECTIVE_LABELS[campaign.objective]}</td>
      <td className="left whitespace-nowrap text-[11.5px]">
        {formatDate(campaign.startDate)}
        {campaign.endDate ? ` – ${formatDate(campaign.endDate)}` : ""}
      </td>
      <td>{formatMoney(campaign.budgetMinor, campaign.currency)}</td>
      <td className="min-w-[110px]">
        <span className="block">{formatMoney(campaign.spentMinor, campaign.currency)}</span>
        <span
          className={cn("meter mt-[4px]", meterStatus)}
          role="img"
          aria-label={`${Math.round(spentFraction * 100)}% of budget spent`}
        >
          <span style={{ width: `${Math.min(100, spentFraction * 100)}%` }} />
        </span>
      </td>
      <td>{campaign.reach === 0 ? "—" : `${(campaignCtr(campaign) * 100).toFixed(2)}%`}</td>
      <td>{campaign.attributedBookings || "—"}</td>
      <td
        className={cn(
          "font-medium",
          roas != null && roas < 1 && "text-critical-fg",
          roas != null && roas >= 2 && "text-healthy-fg",
        )}
      >
        {roas == null ? "—" : `${roas.toFixed(1)}×`}
      </td>
      <td className="left">
        <span className={cn("badge", statusForCampaign(campaign.status))}>
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </span>
      </td>
    </tr>
  );
}
