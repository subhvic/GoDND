"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Copy, Landmark, X } from "lucide-react";

import { Badge } from "@/components/ui/status";
import type { TransactionsData } from "@/lib/data/transactions";
import { PAYOUT_STATUS_LABELS, type Payout } from "@/lib/transactions/types";
import { formatDate, formatMoney } from "@/lib/utils";

/**
 * One payout, laid out so it can be checked against a bank statement:
 * the net figure and the UTR first, then the arithmetic that produced it,
 * then the bookings it covers.
 *
 * The breakdown is shown even when it is obvious, because "why is this
 * ₹4,82,500 and not ₹5,48,300?" is the question that otherwise becomes a
 * support ticket.
 */
export function PayoutDrawer({
  payout,
  data,
  onClose,
}: {
  payout: Payout;
  data: TransactionsData;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const settled = payout.status === "paid";

  return (
    <>
      <div className="scrim" aria-hidden onClick={onClose} />
      <aside
        className="record-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Payout ${payout.reference}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="record-drawer-head">
          <div className="min-w-0">
            <h2 className="record-drawer-title">{payout.reference}</h2>
            <p className="record-drawer-sub">
              {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)} · {payout.lines.length} booking
              {payout.lines.length === 1 ? "" : "s"}
            </p>
          </div>
          <button ref={closeRef} type="button" className="record-drawer-close" aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>

        <div className="record-drawer-body">
          <div className="payout-hero">
            <p className="payout-hero-label">{settled ? "Settled to your bank" : "Net payable to you"}</p>
            <p className="payout-hero-value">{formatMoney(payout.netMinor)}</p>
            <p className="payout-hero-meta">
              <Badge status={settled ? "healthy" : payout.status === "processing" ? "info" : "neutral"}>
                {PAYOUT_STATUS_LABELS[payout.status]}
              </Badge>
              {payout.paidAt ? <span>on {formatDate(payout.paidAt)}</span> : null}
              {payout.expectedAt ? <span>expected {formatDate(payout.expectedAt)}</span> : null}
            </p>
          </div>

          {payout.utr ? (
            <div className="payout-utr">
              <div className="min-w-0">
                <p className="payout-utr-label">Bank reference (UTR)</p>
                <p className="payout-utr-value">{payout.utr}</p>
              </div>
              <button
                type="button"
                className="hbtn small"
                onClick={() => navigator.clipboard?.writeText(payout.utr ?? "")}
              >
                <Copy aria-hidden />
                Copy
              </button>
            </div>
          ) : null}

          <section className="payout-maths" aria-label="How this figure was reached">
            <dl>
              <div>
                <dt>Bookings collected by GoDND</dt>
                <dd>{formatMoney(payout.grossMinor)}</dd>
              </div>
              <div>
                <dt>
                  GoDND commission
                  {payout.grossMinor > 0 ? (
                    <span className="payout-rate">
                      {((payout.commissionMinor / payout.grossMinor) * 100).toFixed(1)}%
                    </span>
                  ) : null}
                </dt>
                <dd className="is-negative">−{formatMoney(payout.commissionMinor)}</dd>
              </div>
              {payout.adjustmentMinor !== 0 ? (
                <div>
                  <dt>Refunds returned to guests</dt>
                  <dd className="is-negative">−{formatMoney(Math.abs(payout.adjustmentMinor))}</dd>
                </div>
              ) : null}
              <div className="is-total">
                <dt>Net</dt>
                <dd>{formatMoney(payout.netMinor)}</dd>
              </div>
            </dl>
          </section>

          {data.canSeeBank ? (
            <section className="payout-bank" aria-label="Destination account">
              <Landmark aria-hidden />
              {data.bank ? (
                <div className="min-w-0">
                  <p className="payout-bank-name">
                    {data.bank.bankName ?? "Your account"} ••••{data.bank.last4 ?? "····"}
                  </p>
                  <p className="payout-bank-meta">
                    {data.bank.accountName}
                    {data.bank.ifsc ? ` · ${data.bank.ifsc}` : ""}
                    {data.bank.verifiedAt ? "" : " · not yet verified"}
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="payout-bank-name">No verified account yet</p>
                  <p className="payout-bank-meta">
                    <Link href="/dashboard/settings/financial" className="link-btn">
                      Add your bank details
                    </Link>{" "}
                    so this can be paid.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          <section aria-label="Bookings in this payout">
            <div className="payout-lines-head">
              <h3>Bookings in this payout</h3>
              <span>{payout.lines.length}</span>
            </div>
            <table className="data-table">
              <caption className="sr-only">Bookings settled in {payout.reference}</caption>
              <thead>
                <tr>
                  <th scope="col">Booking</th>
                  <th scope="col">Gross</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Net</th>
                </tr>
              </thead>
              <tbody>
                {payout.lines.map((line) => (
                  <tr key={line.bookingId}>
                    <th scope="row" className="max-w-[220px]">
                      <span className="cell-stack">
                        <span className="truncate">{line.guestName}</span>
                        <span className="cell-sub">
                          {line.reference} · trip ended {formatDate(line.travelEnd)}
                        </span>
                      </span>
                    </th>
                    <td>{formatMoney(line.grossMinor)}</td>
                    <td className="val-muted">−{formatMoney(line.commissionMinor)}</td>
                    <td className="primary font-medium">{formatMoney(line.netMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </aside>
    </>
  );
}
