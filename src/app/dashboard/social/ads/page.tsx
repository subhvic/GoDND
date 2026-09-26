import Link from "next/link";
import { ArrowRight, ExternalLink, Link2, LinkIcon, Megaphone } from "lucide-react";

import { AdPlatformIcon } from "@/components/social/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import { deriveAdActions, listAdAccounts, listCampaigns } from "@/lib/data/social";
import { listAllBookings } from "@/lib/data/bookings";
import { listExperiences } from "@/lib/data/experiences";
import { statusForCampaign } from "@/lib/status";
import {
  AD_PLATFORM_LABELS,
  campaignCostPerBooking,
  campaignCtr,
  campaignRoas,
  CAMPAIGN_STATUS_LABELS,
  OBJECTIVE_LABELS,
  TRACKING_LABELS,
  type AdAccount,
  type AdCampaign,
  type GrowthAction,
} from "@/lib/social/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Ads" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

/**
 * Ads — read, not run.
 *
 * Campaigns are built where operators already build them, in Meta Ads Manager
 * and Google Ads, and read in here. GoDND's contribution is the half those
 * platforms cannot see: which clicks became bookings, and whether the departure
 * being promoted still has seats to sell.
 *
 * The page is ordered by what the operator can act on. Untracked spend leads,
 * because spend that cannot be measured is worse than spend that performs
 * badly — the second can be fixed by judgement, the first cannot be judged at
 * all. Only then the numbers, and the campaign list last.
 */
export default async function AdsPage() {
  // Every booking, not one tab: seats sold on a departure is a count across
  // the whole list, and the deriver filters out the cancelled ones itself.
  const [{ accounts }, { campaigns }, { rows: experiences }, { rows: bookings }] =
    await Promise.all([
      listAdAccounts(),
      listCampaigns(),
      listExperiences({ tab: "active", pageSize: 50 }),
      listAllBookings(),
    ]);

  const insights = deriveAdActions(campaigns, experiences, bookings);

  const tracked = campaigns.filter((campaign) => campaign.tracking === "tracked");
  const trackedSpend = tracked.reduce((sum, campaign) => sum + campaign.spentMinor, 0);
  const untrackedSpend = campaigns
    .filter((campaign) => campaign.tracking !== "tracked")
    .reduce((sum, campaign) => sum + campaign.spentMinor, 0);
  const revenue = tracked.reduce(
    (sum, campaign) => sum + (campaign.attributedRevenueMinor ?? 0),
    0,
  );
  const bookingsWon = tracked.reduce(
    (sum, campaign) => sum + (campaign.attributedBookings ?? 0),
    0,
  );
  const roas = trackedSpend === 0 ? null : revenue / trackedSpend;
  const totalSpend = trackedSpend + untrackedSpend;
  const untrackedShare = totalSpend === 0 ? 0 : untrackedSpend / totalSpend;

  return (
    <>
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Ads" }]}
        actions={
          <button type="button" disabled className={buttonClass()}>
            <Link2 aria-hidden />
            <span className="hidden sm:inline">Connect ad account</span>
            <span className="sm:hidden">Connect</span>
          </button>
        }
      />

      <div className="surface-card">
        <div className="card-scroll">
          {accounts.length === 0 ? (
            <Notice status="info" title="No ad account connected" className="mb-[16px]">
              Keep running campaigns in Meta Ads Manager and Google Ads. Connect
              the account here and GoDND reads the results back, alongside the
              bookings they produced.
            </Notice>
          ) : null}

          <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            <KpiCard
              label="Measured spend"
              value={formatMoney(trackedSpend)}
              status="neutral"
              comparison={`of ${formatMoney(totalSpend)} total across ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
            />
            <KpiCard
              label="Return on ad spend"
              value={roas == null ? "—" : `${roas.toFixed(1)}×`}
              status={roas == null ? "neutral" : roas >= 2 ? "healthy" : "warning"}
              comparison={
                roas == null
                  ? "nothing measurable spent yet"
                  : `${formatMoney(revenue)} of bookings traced back`
              }
            />
            <KpiCard
              label="Cost per booking"
              value={bookingsWon === 0 ? "—" : formatMoney(Math.round(trackedSpend / bookingsWon))}
              status={bookingsWon === 0 ? "neutral" : "healthy"}
              comparison={
                bookingsWon === 0
                  ? "no bookings traced to ads yet"
                  : `${bookingsWon} booking${bookingsWon === 1 ? "" : "s"} from paid traffic`
              }
            />
            <KpiCard
              label="Unmeasurable spend"
              value={formatMoney(untrackedSpend)}
              status={untrackedShare > 0.2 ? "critical" : untrackedShare > 0 ? "warning" : "healthy"}
              comparison={
                untrackedSpend === 0
                  ? "every campaign is tracked"
                  : `${Math.round(untrackedShare * 100)}% of spend cannot be tied to bookings`
              }
            />
          </div>

          <Panel
            title="What to do next"
            hint="from your spend, your seats and your departures"
            className="mt-[16px]"
          >
            <div className="panel-body">
              {insights.length === 0 ? (
                <p className="m-0 text-[12.5px] text-text-muted">
                  Nothing to flag. Every campaign is tracked and earning.
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {insights.map((insight) => (
                    <InsightRow key={insight.id} insight={insight} />
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {accounts.length > 0 ? (
            <Panel title="Ad accounts" hint="read-only" className="mt-[16px]">
              <div className="panel-body flex flex-wrap gap-[10px]">
                {accounts.map((account) => (
                  <AccountChip key={account.id} account={account} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            title="Campaigns"
            hint="created in the platform, read here"
            className="mt-[16px]"
          >
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <caption className="sr-only">
                  Ad campaigns imported from connected accounts
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col" className="left">Objective</th>
                    <th scope="col" className="left">Runs</th>
                    <th scope="col">Spent</th>
                    <th scope="col">CTR</th>
                    <th scope="col">Bookings</th>
                    <th scope="col">Cost each</th>
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
                          title="No campaigns found"
                          description="Campaigns from your connected Meta and Google accounts appear here within an hour of the first sync."
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

function InsightRow({ insight }: { insight: GrowthAction }) {
  return (
    <li className="action-row">
      <span aria-hidden className={cn("action-dot", insight.severity)} />
      <div className="min-w-0 flex-1">
        <p className="action-title m-0">{insight.title}</p>
        <p className="action-evidence m-0">{insight.evidence}</p>
      </div>
      <Link href={insight.href} className={cn(buttonClass({ size: "small" }), "shrink-0")}>
        {insight.actionLabel}
        <ArrowRight aria-hidden />
      </Link>
    </li>
  );
}

function AccountChip({ account }: { account: AdAccount }) {
  return (
    <div className="flex items-center gap-[9px] rounded-md border border-border-panel px-[11px] py-[8px]">
      <AdPlatformIcon platform={account.platform} />
      <div className="min-w-0">
        <p className="m-0 truncate text-[12px] font-medium text-text-primary">
          {account.name}
        </p>
        <p className="m-0 font-mono text-[10.5px] text-text-muted">
          {account.externalId}
          {account.lastSyncedAt ? ` · synced ${formatDate(account.lastSyncedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: AdCampaign }) {
  const roas = campaignRoas(campaign);
  const costEach = campaignCostPerBooking(campaign);
  const spentFraction =
    campaign.budgetMinor === 0 ? 0 : campaign.spentMinor / campaign.budgetMinor;
  const meterStatus =
    spentFraction >= 0.95 ? "critical" : spentFraction >= 0.8 ? "warning" : "";
  const untraceable = campaign.tracking !== "tracked";

  return (
    <tr>
      <th scope="row" className="max-w-[300px]">
        <span className="row-name">
          <AdPlatformIcon platform={campaign.platform} className="size-[14px] shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-[6px]">
              {campaign.permalink ? (
                <a
                  href={campaign.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="row-name-btn truncate text-[12.5px]"
                >
                  {campaign.name}
                  <ExternalLink aria-hidden className="ml-[4px] inline size-[11px] align-[-1px]" />
                  <span className="sr-only">
                    (opens in {AD_PLATFORM_LABELS[campaign.platform]})
                  </span>
                </a>
              ) : (
                <span className="truncate text-[12.5px] font-medium">{campaign.name}</span>
              )}
            </span>
            <span className="mt-[2px] flex items-center gap-[5px]">
              <TrackingChip campaign={campaign} />
              {campaign.experienceTitle ? (
                <span className="truncate text-[10.5px] text-text-muted">
                  {campaign.experienceTitle}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </th>
      <td className="left">{OBJECTIVE_LABELS[campaign.objective]}</td>
      <td className="left whitespace-nowrap text-[11.5px]">
        {formatDate(campaign.startDate)}
        {campaign.endDate ? ` – ${formatDate(campaign.endDate)}` : " – ongoing"}
      </td>
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
      {/* A dash would read as zero bookings. Untracked means unknowable, and
          the two must not look the same. */}
      <td className={cn(untraceable && "text-text-muted")}>
        {untraceable ? "Unknown" : (campaign.attributedBookings ?? 0) || "—"}
      </td>
      <td className={cn(untraceable && "text-text-muted")}>
        {untraceable ? "Unknown" : costEach == null ? "—" : formatMoney(Math.round(costEach))}
      </td>
      <td
        className={cn(
          "font-medium",
          untraceable && "font-normal text-text-muted",
          roas != null && roas < 1 && "text-critical-fg",
          roas != null && roas >= 2 && "text-healthy-fg",
        )}
      >
        {untraceable ? "Unknown" : roas == null ? "—" : `${roas.toFixed(1)}×`}
      </td>
      <td className="left">
        <span className={cn("badge", statusForCampaign(campaign.status))}>
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </span>
      </td>
    </tr>
  );
}

function TrackingChip({ campaign }: { campaign: AdCampaign }) {
  if (campaign.tracking === "tracked") {
    return (
      <span className="inline-flex shrink-0 items-center gap-[3px] text-[10.5px] text-text-muted">
        <LinkIcon aria-hidden className="size-[10px]" />
        {TRACKING_LABELS.tracked}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "badge shrink-0",
        campaign.tracking === "mismatched" ? "critical" : "warning",
      )}
    >
      {TRACKING_LABELS[campaign.tracking]}
    </span>
  );
}
