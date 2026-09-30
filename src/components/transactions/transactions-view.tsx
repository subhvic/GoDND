"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, Landmark, Wallet } from "lucide-react";

import { PayoutDrawer } from "@/components/transactions/payout-drawer";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineSelect } from "@/components/ui/inline-select";
import { KpiCard } from "@/components/ui/kpi-card";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Badge } from "@/components/ui/status";
import type { TransactionsData } from "@/lib/data/transactions";
import type { Status } from "@/lib/status";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYOUT_STATUS_LABELS,
  TRANSACTION_PERIODS,
  TRANSACTION_TABS,
  type Invoice,
  type PaymentRow,
  type Payout,
  type RefundRow,
  type TransactionPeriod,
  type TransactionTab,
} from "@/lib/transactions/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

/**
 * Transactions — where the operator's money is.
 *
 * The summary answers the four questions in the order they matter to
 * someone running a small business on thin cash flow: what has reached my
 * bank, what is still coming, who owes me, and what do I owe back. The
 * tabs underneath are the evidence for each of those, and every one of
 * them reconciles to a booking.
 */
export function TransactionsView({ data, tab }: { data: TransactionsData; tab: TransactionTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openPayout, setOpenPayout] = useState<Payout | null>(null);

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const counts: Record<TransactionTab, number> = {
    payouts: data.payouts.length,
    payments: data.payments.length,
    invoices: data.invoices.length,
    refunds: data.refunds.length,
  };

  return (
    <>
      <PageBar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transactions" }]}
        actions={
          <>
            <InlineSelect
              label="Period"
              value={data.period}
              onChange={(value: TransactionPeriod) => router.push(hrefWith({ period: value }))}
              options={TRANSACTION_PERIODS.map((period) => ({ value: period.key, label: period.label }))}
            />
            <ExportButton data={data} tab={tab} />
          </>
        }
      />

      <div className="body-scroll">
        <div className="money">
          <BankNotice data={data} />
          <Headline data={data} />

          <PillTabs
            label="Transaction records"
            active={tab}
            tabs={TRANSACTION_TABS.map((entry) => ({
              id: entry.key,
              label: entry.label,
              count: counts[entry.key],
              countTone: entry.key === "refunds" && data.summary.refundsOwedCount > 0 ? "warning" : undefined,
              href: hrefWith({ tab: entry.key === "payouts" ? null : entry.key }),
            }))}
          />

          {tab === "payouts" ? <Payouts data={data} onOpen={setOpenPayout} /> : null}
          {tab === "payments" ? <Payments rows={data.payments} /> : null}
          {tab === "invoices" ? <Invoices rows={data.invoices} /> : null}
          {tab === "refunds" ? <Refunds rows={data.refunds} /> : null}

          {data.isDemoData ? (
            <p className="m-0 field-hint">
              Sample figures for a preview workspace, derived from the same bookings Insights counts.
            </p>
          ) : null}
        </div>
      </div>

      {openPayout ? (
        <PayoutDrawer payout={openPayout} data={data} onClose={() => setOpenPayout(null)} />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Headline
 * ----------------------------------------------------------------------- */

function change(value: number, previous: number, periodLabel: string) {
  if (previous === 0) return value === 0 ? "nothing settled before" : "first settlement";
  const delta = Math.round(((value - previous) / previous) * 100);
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta)}% vs the ${periodLabel}`;
}

function Headline({ data }: { data: TransactionsData }) {
  const { summary } = data;
  const nextOn = summary.nextPayoutOn ? formatDate(summary.nextPayoutOn) : null;

  return (
    <section aria-label="Where your money is" className="money-kpis">
      <KpiCard
        label="Settled to your bank"
        value={formatMoney(summary.paidOutMinor)}
        status={summary.paidOutMinor >= summary.paidOutPreviousMinor ? "healthy" : "warning"}
        comparison={`${change(
          summary.paidOutMinor,
          summary.paidOutPreviousMinor,
          data.periodLabel,
        )} · after ${formatMoney(summary.commissionMinor)} commission`}
      />
      <KpiCard
        label="Awaiting payout"
        value={formatMoney(summary.awaitingPayoutMinor)}
        status={!data.bankVerified && summary.awaitingPayoutMinor > 0 ? "critical" : "healthy"}
        comparison={
          !data.bankVerified && summary.awaitingPayoutMinor > 0
            ? "Held until your bank details are verified"
            : nextOn
              ? `Expected ${nextOn}`
              : "Nothing pending"
        }
      />
      <KpiCard
        label="Due from guests"
        value={formatMoney(summary.dueFromGuestsMinor)}
        status={summary.overdueCount > 0 ? "warning" : "healthy"}
        comparison={
          summary.overdueCount > 0
            ? `${formatMoney(summary.overdueFromGuestsMinor)} overdue across ${summary.overdueCount} booking${
                summary.overdueCount === 1 ? "" : "s"
              }`
            : "Nothing overdue"
        }
      />
      <KpiCard
        label="Refunds you owe"
        value={formatMoney(summary.refundsOwedMinor)}
        status={summary.refundsOwedCount > 0 ? "critical" : "healthy"}
        comparison={
          summary.refundsOwedCount > 0
            ? `${summary.refundsOwedCount} guest${summary.refundsOwedCount === 1 ? "" : "s"} waiting`
            : "Nothing outstanding"
        }
      />
    </section>
  );
}

/**
 * The one thing that stops money arriving. Settings is where it's fixed, so
 * the notice links straight at the section rather than describing it.
 */
function BankNotice({ data }: { data: TransactionsData }) {
  if (data.bankVerified || data.summary.awaitingPayoutMinor === 0) return null;
  return (
    <Notice status="critical" title="Payouts are on hold" role="status">
      GoDND can’t settle {formatMoney(data.summary.awaitingPayoutMinor)} until your bank details are verified.
      Nothing is lost — it is released as soon as the check clears.{" "}
      <Link href="/dashboard/settings/financial" className="link-btn">
        Add your bank details
      </Link>
    </Notice>
  );
}

/* --------------------------------------------------------------------------
 * Payouts
 * ----------------------------------------------------------------------- */

const PAYOUT_STATUS: Record<Payout["status"], Status> = {
  paid: "healthy",
  processing: "info",
  pending: "neutral",
  failed: "critical",
  on_hold: "warning",
};

function Payouts({ data, onOpen }: { data: TransactionsData; onOpen: (payout: Payout) => void }) {
  if (data.payouts.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Wallet}
          title="No payouts yet"
          description="GoDND settles marketplace bookings after each trip ends, on the 1st and the 16th."
        />
      </Panel>
    );
  }

  return (
    <Panel title="Payouts" hint="marketplace bookings, settled after the trip">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <caption className="sr-only">Payouts from GoDND</caption>
          <thead>
            <tr>
              <th scope="col">Payout</th>
              <th scope="col" className="left">Period</th>
              <th scope="col">Bookings</th>
              <th scope="col">Gross</th>
              <th scope="col">Commission</th>
              <th scope="col">Net</th>
              <th scope="col" className="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.payouts.map((payout) => (
              <tr key={payout.id} className="clickable" onClick={() => onOpen(payout)}>
                <th scope="row">
                  <button type="button" className="row-name-btn row-name" onClick={() => onOpen(payout)}>
                    {payout.reference}
                  </button>
                </th>
                <td className="left">
                  {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
                </td>
                <td>{payout.lines.length}</td>
                <td>{formatMoney(payout.grossMinor)}</td>
                <td className="val-muted">−{formatMoney(payout.commissionMinor)}</td>
                <td className="primary font-medium">{formatMoney(payout.netMinor)}</td>
                <td className="left">
                  <span className="money-status">
                    <Badge status={PAYOUT_STATUS[payout.status]}>{PAYOUT_STATUS_LABELS[payout.status]}</Badge>
                    <span className="cell-sub-inline">
                      {payout.paidAt
                        ? formatDate(payout.paidAt)
                        : payout.expectedAt
                          ? `due ${formatDate(payout.expectedAt)}`
                          : ""}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Payments
 * ----------------------------------------------------------------------- */

const PAGE = 25;

function Payments({ rows }: { rows: PaymentRow[] }) {
  const [shown, setShown] = useState(PAGE);
  const visible = useMemo(() => rows.slice(0, shown), [rows, shown]);

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState icon={Wallet} title="No payments yet" description="Money guests pay you appears here." />
      </Panel>
    );
  }

  return (
    <Panel title="Payments" hint="every movement, newest first">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[840px]">
          <caption className="sr-only">Payments in and refunds out</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" className="left">Booking</th>
              <th scope="col" className="left">Guest</th>
              <th scope="col" className="left">Method</th>
              <th scope="col" className="left">Collected by</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((payment) => (
              <tr key={payment.id}>
                <th scope="row">{formatDate(payment.createdAt)}</th>
                <td className="left">
                  <span className="cell-stack">
                    <span>{payment.bookingRef}</span>
                    <span className="cell-sub">{payment.note}</span>
                  </span>
                </td>
                <td className="left">{payment.guestName}</td>
                <td className="left">{PAYMENT_METHOD_LABELS[payment.method]}</td>
                <td className="left">
                  {payment.collectedByPlatform ? (
                    <Badge status="info">GoDND</Badge>
                  ) : (
                    <Badge status="neutral">You</Badge>
                  )}
                </td>
                <td className={cn("font-medium", payment.direction === "refund" ? "val-critical" : "primary")}>
                  {payment.direction === "refund" ? "−" : "+"}
                  {formatMoney(payment.amountMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < rows.length ? (
        <div className="panel-body pt-0 text-center">
          <button type="button" className={buttonClass()} onClick={() => setShown((value) => value + PAGE)}>
            Show more ({rows.length - shown} left)
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Invoices
 * ----------------------------------------------------------------------- */

const INVOICE_STATUS: Record<Invoice["status"], Status> = {
  paid: "healthy",
  partially_paid: "warning",
  issued: "info",
  overdue: "critical",
  void: "neutral",
};

function Invoices({ rows }: { rows: Invoice[] }) {
  const [shown, setShown] = useState(PAGE);

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="A GST invoice is raised for every booking that takes money."
        />
      </Panel>
    );
  }

  return (
    <Panel title="Invoices" hint="GST tax invoices, numbered by financial year">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[880px]">
          <caption className="sr-only">GST invoices</caption>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Date</th>
              <th scope="col" className="left">Guest</th>
              <th scope="col" className="left">Place of supply</th>
              <th scope="col">Taxable</th>
              <th scope="col">GST</th>
              <th scope="col">Total</th>
              <th scope="col" className="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((invoice) => (
              <tr key={invoice.id}>
                <th scope="row">
                  <Link href={`/dashboard/transactions/invoices/${invoice.id}`} className="insights-link">
                    {invoice.number}
                  </Link>
                </th>
                <td>{formatDate(invoice.issuedAt)}</td>
                <td className="left">
                  <span className="cell-stack">
                    <span>{invoice.billToName}</span>
                    <span className="cell-sub">{invoice.bookingRef}</span>
                  </span>
                </td>
                <td className="left">{invoice.placeOfSupplyName}</td>
                <td>{formatMoney(invoice.taxableMinor)}</td>
                <td>
                  {formatMoney(invoice.cgstMinor + invoice.sgstMinor + invoice.igstMinor)}
                  <span className="cell-sub-inline"> {invoice.igstMinor > 0 ? "IGST" : "CGST+SGST"}</span>
                </td>
                <td className="primary font-medium">{formatMoney(invoice.totalMinor)}</td>
                <td className="left">
                  <Badge status={INVOICE_STATUS[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < rows.length ? (
        <div className="panel-body pt-0 text-center">
          <button type="button" className={buttonClass()} onClick={() => setShown((value) => value + PAGE)}>
            Show more ({rows.length - shown} left)
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Refunds
 * ----------------------------------------------------------------------- */

function Refunds({ rows }: { rows: RefundRow[] }) {
  const [shown, setShown] = useState(PAGE);
  const owed = rows.filter((row) => row.refundedAt === null);

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState icon={Landmark} title="No refunds" description="Nothing has been cancelled with money on it." />
      </Panel>
    );
  }

  return (
    <Panel
      title="Refunds"
      hint={owed.length > 0 ? `${owed.length} still to send` : "all settled"}
      actions={
        owed.length > 0 ? (
          <span className="text-[11.5px] text-text-muted">
            <AlertTriangle aria-hidden className="inline size-[13px] text-warning" />{" "}
            {formatMoney(owed.reduce((total, row) => total + row.amountMinor, 0))} outstanding
          </span>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="data-table min-w-[800px]">
          <caption className="sr-only">Refunds owed and sent</caption>
          <thead>
            <tr>
              <th scope="col">Booking</th>
              <th scope="col" className="left">Guest</th>
              <th scope="col" className="left">Experience</th>
              <th scope="col">Cancelled</th>
              <th scope="col">Amount</th>
              <th scope="col" className="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((row) => (
              <tr key={row.bookingId}>
                <th scope="row">{row.bookingRef}</th>
                <td className="left">{row.guestName}</td>
                <td className="left max-w-[260px]">
                  <span className="block truncate">{row.experienceTitle}</span>
                </td>
                <td>{formatDate(row.cancelledAt)}</td>
                <td className="primary font-medium">{formatMoney(row.amountMinor)}</td>
                <td className="left">
                  {row.refundedAt ? (
                    <span className="money-status">
                      <Badge status="neutral">Sent</Badge>
                      <span className="cell-sub-inline">{formatDate(row.refundedAt)}</span>
                    </span>
                  ) : (
                    <Badge status="warning">
                      {row.isMarketplace ? "GoDND is returning it" : "You owe this"}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < rows.length ? (
        <div className="panel-body pt-0 text-center">
          <button type="button" className={buttonClass()} onClick={() => setShown((value) => value + PAGE)}>
            Show more ({rows.length - shown} left)
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Export
 * ----------------------------------------------------------------------- */

/**
 * The current tab as a CSV, because the next thing that happens to these
 * numbers is a spreadsheet an accountant opens.
 */
function ExportButton({ data, tab }: { data: TransactionsData; tab: TransactionTab }) {
  const download = () => {
    const { name, rows } = csvFor(data, tab);
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" className={buttonClass()} onClick={download}>
      <Download aria-hidden />
      <span className="hidden sm:inline">Export CSV</span>
    </button>
  );
}

const rupees = (minor: number) => (minor / 100).toFixed(2);

function csvFor(data: TransactionsData, tab: TransactionTab): { name: string; rows: (string | number)[][] } {
  switch (tab) {
    case "payouts":
      return {
        name: `godnd-payouts-${data.period}.csv`,
        rows: [
          ["Payout", "Period start", "Period end", "Bookings", "Gross", "Commission", "Adjustment", "Net", "Status", "Paid on", "UTR"],
          ...data.payouts.map((payout) => [
            payout.reference,
            payout.periodStart.slice(0, 10),
            payout.periodEnd.slice(0, 10),
            payout.lines.length,
            rupees(payout.grossMinor),
            rupees(payout.commissionMinor),
            rupees(payout.adjustmentMinor),
            rupees(payout.netMinor),
            PAYOUT_STATUS_LABELS[payout.status],
            payout.paidAt?.slice(0, 10) ?? "",
            payout.utr ?? "",
          ]),
        ],
      };
    case "payments":
      return {
        name: `godnd-payments-${data.period}.csv`,
        rows: [
          ["Date", "Booking", "Guest", "Direction", "Method", "Collected by", "Amount", "Gateway reference"],
          ...data.payments.map((payment) => [
            payment.createdAt.slice(0, 10),
            payment.bookingRef,
            payment.guestName,
            payment.direction,
            PAYMENT_METHOD_LABELS[payment.method],
            payment.collectedByPlatform ? "GoDND" : "Operator",
            rupees(payment.amountMinor),
            payment.gatewayRef ?? "",
          ]),
        ],
      };
    case "invoices":
      // The columns a GSTR-1 return is built from.
      return {
        name: `godnd-invoices-${data.period}.csv`,
        rows: [
          ["Invoice", "Date", "Guest", "GSTIN", "Place of supply", "SAC", "Taxable", "Rate %", "CGST", "SGST", "IGST", "Total", "Status"],
          ...data.invoices.map((invoice) => [
            invoice.number,
            invoice.issuedAt.slice(0, 10),
            invoice.billToName,
            invoice.billToGstin ?? "",
            invoice.placeOfSupplyName,
            invoice.lines[0]?.sacCode ?? "",
            rupees(invoice.taxableMinor),
            invoice.taxRateBps / 100,
            rupees(invoice.cgstMinor),
            rupees(invoice.sgstMinor),
            rupees(invoice.igstMinor),
            rupees(invoice.totalMinor),
            INVOICE_STATUS_LABELS[invoice.status],
          ]),
        ],
      };
    case "refunds":
      return {
        name: `godnd-refunds-${data.period}.csv`,
        rows: [
          ["Booking", "Guest", "Experience", "Cancelled", "Amount", "Refunded on", "Status"],
          ...data.refunds.map((row) => [
            row.bookingRef,
            row.guestName,
            row.experienceTitle,
            row.cancelledAt.slice(0, 10),
            rupees(row.amountMinor),
            row.refundedAt?.slice(0, 10) ?? "",
            row.refundedAt ? "Sent" : "Owed",
          ]),
        ],
      };
  }
}
