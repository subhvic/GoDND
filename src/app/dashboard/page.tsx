import Link from "next/link";
import { Plus } from "lucide-react";

import { ConversionChart } from "@/components/home/conversion-chart";
import { ExperienceFunnel } from "@/components/home/experience-funnel";
import { HomeRecordsProvider } from "@/components/home/home-records";
import { LatestBookings } from "@/components/home/latest-bookings";
import { RecentExperiences } from "@/components/home/recent-experiences";
import { buttonClass } from "@/components/ui/button";
import { PageBar } from "@/components/ui/page-bar";
import { listLatestBookings } from "@/lib/data/bookings";
import { listRecentExperiences } from "@/lib/data/experiences";
import { getHomeInsights } from "@/lib/data/insights";
import { dayKey } from "@/lib/time";

export const metadata = { title: "Home" };

/**
 * portal.godnd.co/dashboard — Home (handoff: Login & Home › Home - Ground
 * Instance). Where the portal opens after sign-in: how the catalogue is
 * converting, what just came in, and what was just started.
 *
 * The three reads are independent, so they run together; the page waits
 * on the slowest one, not the sum of all three.
 */
export default async function HomePage() {
  const [insights, latestBookings, recentExperiences] = await Promise.all([
    getHomeInsights(),
    listLatestBookings(4),
    listRecentExperiences(3),
  ]);

  return (
    <>
      <PageBar
        crumbs={[{ label: "Home" }]}
        actions={
          <Link href="/dashboard/experiences/new" className={buttonClass({ variant: "primary" })}>
            <Plus aria-hidden />
            <span className="hidden sm:inline">Add experience</span>
            <span className="sm:hidden">Add</span>
          </Link>
        }
      />

      <div className="surface-card">
        <HomeRecordsProvider>
          <div className="card-scroll">
            <div className="home">
              <ExperienceFunnel figures={insights.funnel} />
              <div className="home-split">
                <ConversionChart series={insights.conversion} />
                <LatestBookings rows={latestBookings} today={dayKey(new Date())} />
              </div>
              <RecentExperiences rows={recentExperiences} />
            </div>
          </div>
        </HomeRecordsProvider>
      </div>
    </>
  );
}
