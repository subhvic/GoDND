import { InsightsView } from "@/components/insights/insights-view";
import { getInsightsReport } from "@/lib/data/insights-report";
import { isInsightPeriod } from "@/lib/insights/report";

export const metadata = { title: "Insights" };

/**
 * Every period is computed here at once, so switching "Last 30 days" to
 * "Last 12 months" is instant; ?period= only chooses which one opens.
 */
export default async function InsightsPage(props: PageProps<"/dashboard/insights">) {
  const { period } = await props.searchParams;
  const report = await getInsightsReport();
  return <InsightsView report={report} initialPeriod={isInsightPeriod(period) ? period : "30d"} />;
}
