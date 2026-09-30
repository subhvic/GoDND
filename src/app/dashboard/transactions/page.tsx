import { TransactionsView } from "@/components/transactions/transactions-view";
import { getTransactions } from "@/lib/data/transactions";
import { isTransactionPeriod, isTransactionTab } from "@/lib/transactions/types";

export const metadata = { title: "Transactions" };

/**
 * Money, filtered from the URL so a view can be sent to an accountant as a
 * link rather than described.
 */
export default async function TransactionsPage(props: PageProps<"/dashboard/transactions">) {
  const params = await props.searchParams;
  const period = isTransactionPeriod(params.period) ? params.period : "30d";
  const data = await getTransactions(period);

  return <TransactionsView data={data} tab={isTransactionTab(params.tab) ? params.tab : "payouts"} />;
}
