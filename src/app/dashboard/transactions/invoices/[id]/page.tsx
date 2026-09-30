import { notFound } from "next/navigation";

import { InvoiceDocument } from "@/components/transactions/invoice-document";
import { getInvoice } from "@/lib/data/transactions";
import { getSettings } from "@/lib/data/settings";

export const metadata = { title: "Tax invoice" };

/**
 * One GST tax invoice, as a document rather than a record: it is printed,
 * emailed to a guest, and handed to an accountant, so it carries the
 * supplier and recipient blocks, the SAC code and the tax split that a
 * valid invoice is required to show.
 */
export default async function InvoicePage(props: PageProps<"/dashboard/transactions/invoices/[id]">) {
  const { id } = await props.params;
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice) notFound();

  return <InvoiceDocument invoice={invoice} supplier={settings?.state ?? null} />;
}
