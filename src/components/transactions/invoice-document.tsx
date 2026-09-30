"use client";

import { Printer } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { Badge } from "@/components/ui/status";
import type { SettingsState } from "@/lib/settings/model";
import { INDIA_STATES, stateLabel } from "@/lib/settings/options";
import { INVOICE_STATUS_LABELS, type Invoice } from "@/lib/transactions/types";
import { formatDate, formatMoney } from "@/lib/utils";

/**
 * A tax invoice under the GST rules: supplier and recipient with their
 * GSTINs, a consecutive number inside the financial year, the SAC code for
 * the service, the taxable value and the tax split, and the total in words
 * — which Indian invoices carry because a figure alone is easy to alter.
 *
 * It prints. Generating a PDF on the server would be a second rendering of
 * the same document to keep in step; the browser already does it, and what
 * prints is exactly what is on screen.
 */
export function InvoiceDocument({
  invoice,
  supplier,
}: {
  invoice: Invoice;
  supplier: SettingsState | null;
}) {
  const basic = supplier?.basicInfo.values;
  const compliance = supplier?.compliance.values;
  const operations = supplier?.operations.values;
  const intrastate = invoice.igstMinor === 0;
  const rate = invoice.taxRateBps / 100;

  return (
    <>
      <PageBar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Transactions", href: "/dashboard/transactions?tab=invoices" },
          { label: invoice.number },
        ]}
        actions={
          <button type="button" className={buttonClass({ variant: "primary" })} onClick={() => window.print()}>
            <Printer aria-hidden />
            <span className="hidden sm:inline">Print or save as PDF</span>
            <span className="sm:hidden">Print</span>
          </button>
        }
      />

      <div className="surface-card">
        <div className="card-scroll">
          {invoice.voidedAt ? (
            <Notice status="warning" title="This invoice has been cancelled" className="mb-[16px] no-print">
              The trip was cancelled on {formatDate(invoice.voidedAt)} and credit note {invoice.creditNoteFor} was
              raised against it. A GST invoice is credited rather than deleted, so this stays on the record.
            </Notice>
          ) : null}

          <article className="invoice-doc">
            <header className="invoice-doc-head">
              <div className="min-w-0">
                <p className="invoice-doc-kind">Tax invoice</p>
                <h2 className="invoice-doc-title">{operations?.brandName || basic?.legalName || "Your company"}</h2>
                <address className="invoice-doc-address">
                  {basic?.legalName ? <span>{basic.legalName}</span> : null}
                  {basic?.addressLine1 ? <span>{basic.addressLine1}</span> : null}
                  {basic?.addressLine2 ? <span>{basic.addressLine2}</span> : null}
                  {basic?.city ? (
                    <span>
                      {basic.city}
                      {basic.state ? `, ${stateLabel(basic.state)}` : ""} {basic.pincode}
                    </span>
                  ) : null}
                  {basic?.email ? <span>{basic.email}</span> : null}
                  {basic?.phone ? <span>{basic.phone}</span> : null}
                </address>
                <dl className="invoice-doc-ids">
                  {compliance?.gstin ? (
                    <div>
                      <dt>GSTIN</dt>
                      <dd>{compliance.gstin}</dd>
                    </div>
                  ) : null}
                  {compliance?.pan ? (
                    <div>
                      <dt>PAN</dt>
                      <dd>{compliance.pan}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <dl className="invoice-doc-meta">
                <div>
                  <dt>Invoice no.</dt>
                  <dd className="is-strong">{invoice.number}</dd>
                </div>
                <div>
                  <dt>Invoice date</dt>
                  <dd>{formatDate(invoice.issuedAt)}</dd>
                </div>
                <div>
                  <dt>Booking</dt>
                  <dd>{invoice.bookingRef}</dd>
                </div>
                <div>
                  <dt>Place of supply</dt>
                  <dd>
                    {invoice.placeOfSupplyName}
                    {stateCode(invoice.placeOfSupply) ? ` (${stateCode(invoice.placeOfSupply)})` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge status={invoice.status === "paid" ? "healthy" : invoice.status === "void" ? "neutral" : "warning"}>
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </header>

            <section className="invoice-doc-party" aria-label="Billed to">
              <h3>Billed to</h3>
              <p className="invoice-doc-party-name">{invoice.billToName}</p>
              {invoice.billToEmail ? <p>{invoice.billToEmail}</p> : null}
              <p>
                {invoice.billToGstin ? (
                  <>GSTIN {invoice.billToGstin}</>
                ) : (
                  <span className="text-text-muted">Unregistered (B2C)</span>
                )}
              </p>
            </section>

            <table className="data-table invoice-doc-lines">
              <caption className="sr-only">Invoice line items</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">SAC</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Taxable value</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line, index) => (
                  <tr key={index}>
                    <th scope="row">{line.description}</th>
                    <td>{line.sacCode}</td>
                    <td>{line.quantity}</td>
                    <td>{formatMoney(line.unitPriceMinor)}</td>
                    <td className="primary">{formatMoney(line.taxableMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-doc-totals">
              <dl>
                <div>
                  <dt>Taxable value</dt>
                  <dd>{formatMoney(invoice.taxableMinor)}</dd>
                </div>
                {intrastate ? (
                  <>
                    <div>
                      <dt>CGST @ {(rate / 2).toFixed(2)}%</dt>
                      <dd>{formatMoney(invoice.cgstMinor)}</dd>
                    </div>
                    <div>
                      <dt>SGST @ {(rate / 2).toFixed(2)}%</dt>
                      <dd>{formatMoney(invoice.sgstMinor)}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>IGST @ {rate.toFixed(2)}%</dt>
                    <dd>{formatMoney(invoice.igstMinor)}</dd>
                  </div>
                )}
                <div className="is-total">
                  <dt>Total</dt>
                  <dd>{formatMoney(invoice.totalMinor)}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatMoney(invoice.amountPaidMinor)}</dd>
                </div>
                {invoice.totalMinor - invoice.amountPaidMinor > 0 ? (
                  <div className="is-due">
                    <dt>Balance due{invoice.dueAt ? ` by ${formatDate(invoice.dueAt)}` : ""}</dt>
                    <dd>{formatMoney(invoice.totalMinor - invoice.amountPaidMinor)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <p className="invoice-doc-words">
              <span>Amount in words</span>
              {inWords(invoice.totalMinor)}
            </p>

            <footer className="invoice-doc-foot">
              <p>
                Tax on this supply is payable under the tour operator rate ({rate}% without input tax credit,
                SAC {invoice.lines[0]?.sacCode ?? "9985"}).
                {invoice.isMarketplace
                  ? " Collected through the GoDND marketplace."
                  : " Collected directly by the operator."}
              </p>
              <p className="invoice-doc-sign">
                For {operations?.brandName || basic?.legalName || "the operator"}
                <span>Authorised signatory</span>
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}

const stateCode = (value: string) => INDIA_STATES.find((state) => state.value === value)?.gst ?? "";

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underHundred(value: number): string {
  if (value < 20) return ONES[value];
  return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${ONES[value % 10]}` : ""}`;
}

/**
 * Rupees in the Indian system — lakh and crore, not million — because that
 * is what an invoice here is read against.
 */
function inWords(minor: number): string {
  const rupees = Math.floor(minor / 100);
  const paise = minor % 100;
  if (rupees === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const units: [number, string][] = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
    [100, "Hundred"],
  ];

  let left = rupees;
  for (const [size, name] of units) {
    const count = Math.floor(left / size);
    if (count > 0) {
      parts.push(`${count >= 100 ? inWords(count * 100).replace(" Rupees Only", "") : underHundred(count)} ${name}`);
      left -= count * size;
    }
  }
  if (left > 0) parts.push(underHundred(left));

  const rupeeWords = `${parts.join(" ")} Rupees`;
  return paise > 0 ? `${rupeeWords} and ${underHundred(paise)} Paise Only` : `${rupeeWords} Only`;
}
