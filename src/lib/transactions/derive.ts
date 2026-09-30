import type { DemoBooking } from "@/lib/insights/demo";
import { INDIA_STATES } from "@/lib/settings/options";
import type {
  Invoice,
  InvoiceStatus,
  MoneySummary,
  PaymentMethod,
  PaymentRow,
  Payout,
  PayoutLine,
  PayoutStatus,
  RefundRow,
  TransactionPeriod,
} from "@/lib/transactions/types";

/**
 * Turning bookings into the money record.
 *
 * Every figure on the Transactions screen is derived here from the same
 * bookings Insights counts, so "₹82,28,500 booked" there and the ledger
 * here can never disagree. Live, these rows come from their own tables
 * (payments, invoices, payouts) written by the payment gateway and the
 * settlement job; this is the sample workspace's stand-in, and it follows
 * exactly the same shapes.
 */

const DAY = 86_400_000;
const IST = 330 * 60_000;

/** The operator's home state — where Settings says the business is registered. */
export const OPERATOR_STATE = "ML";

/** Tour operator services. 5% GST, no input tax credit. */
export const SAC_CODE = "9985";
export const GST_RATE_BPS = 500;

/** Money is released after the trip, on the 1st–15th / 16th–end cycle. */
export const PAYOUT_CYCLE_DAYS = 15;
/** How long after a cycle closes the money reaches the bank. */
export const SETTLEMENT_LAG_DAYS = 5;

const istParts = (ms: number) => {
  const date = new Date(ms + IST);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
};

const istMidnight = (year: number, month: number, day: number) => Date.UTC(year, month, day) - IST;

const isoDay = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);

/** India's financial year runs April to March: 3 Feb 2027 is FY 26-27. */
export function financialYear(ms: number): { label: string; startMs: number; endMs: number } {
  const { year, month } = istParts(ms);
  const startYear = month >= 3 ? year : year - 1;
  return {
    label: `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`,
    startMs: istMidnight(startYear, 3, 1),
    endMs: istMidnight(startYear + 1, 3, 1),
  };
}

/** The FY quarter containing the instant: Q1 is April to June. */
export function financialQuarter(ms: number): { startMs: number; endMs: number } {
  const { year, month } = istParts(ms);
  const index = Math.floor(((month + 9) % 12) / 3);
  const startMonth = 3 + index * 3;
  const startYear = month >= 3 ? year : year - 1;
  return {
    startMs: istMidnight(startYear, startMonth, 1),
    endMs: istMidnight(startYear, startMonth + 3, 1),
  };
}

/**
 * `previousEndMs` runs the same length as the elapsed current window, so a
 * financial year three months old is compared with the first three months
 * of the year before rather than with all twelve of them.
 */
export type Window = {
  startMs: number;
  endMs: number;
  previousStartMs: number;
  previousEndMs: number;
  label: string;
};

export function periodWindow(period: TransactionPeriod, nowMs: number): Window {
  const today = istParts(nowMs);
  const tomorrow = istMidnight(today.year, today.month, today.day + 1);

  const against = (startMs: number, previousStartMs: number, label: string): Window => ({
    startMs,
    endMs: tomorrow,
    previousStartMs,
    previousEndMs: previousStartMs + (tomorrow - startMs),
    label,
  });

  if (period === "30d") {
    const start = tomorrow - 30 * DAY;
    return against(start, start - 30 * DAY, "previous 30 days");
  }
  if (period === "quarter") {
    const { startMs } = financialQuarter(nowMs);
    return against(startMs, financialQuarter(startMs - DAY).startMs, "same point last quarter");
  }
  if (period === "fy") {
    const { startMs } = financialYear(nowMs);
    return against(startMs, financialYear(startMs - DAY).startMs, "same point last year");
  }
  return { startMs: 0, endMs: tomorrow, previousStartMs: 0, previousEndMs: 0, label: "all time" };
}

const at = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const within = (ms: number, start: number, end: number) => ms >= start && ms < end;

/** Settled once the trip is over and nothing was refunded. */
const isPayable = (booking: DemoBooking) =>
  booking.isMarketplace && (booking.status === "paid" || booking.status === "completed");

/* --------------------------------------------------------------------------
 * Payouts
 * ----------------------------------------------------------------------- */

/** The 1st–15th or 16th–end window a date falls in. */
function cycleOf(ms: number) {
  const { year, month, day } = istParts(ms);
  const secondHalf = day > PAYOUT_CYCLE_DAYS;
  const startMs = istMidnight(year, month, secondHalf ? 16 : 1);
  const endMs = secondHalf ? istMidnight(year, month + 1, 1) : istMidnight(year, month, 16);
  return { key: `${isoDay(startMs)}`, startMs, endMs };
}

/**
 * One payout per cycle, holding the marketplace bookings whose trips ended
 * inside it. A refund raised against an already-settled booking comes off
 * the same cycle as an adjustment, which is how a real settlement note
 * reads.
 */
export function derivePayouts(bookings: DemoBooking[], nowMs: number): Payout[] {
  const cycles = new Map<string, { startMs: number; endMs: number; lines: PayoutLine[]; adjustment: number }>();

  const cycleFor = (ms: number) => {
    const cycle = cycleOf(ms);
    const existing = cycles.get(cycle.key);
    if (existing) return existing;
    const created = { startMs: cycle.startMs, endMs: cycle.endMs, lines: [], adjustment: 0 };
    cycles.set(cycle.key, created);
    return created;
  };

  for (const booking of bookings) {
    const travelEnd = at(booking.travelEnd);
    if (travelEnd > nowMs) continue;

    if (isPayable(booking)) {
      cycleFor(travelEnd).lines.push({
        bookingId: booking.id,
        reference: booking.reference,
        guestName: booking.guestName,
        experienceTitle: booking.experienceTitle,
        travelEnd: isoDay(travelEnd),
        grossMinor: booking.totalMinor,
        commissionMinor: booking.commissionMinor,
        netMinor: booking.totalMinor - booking.commissionMinor,
      });
    } else if (booking.isMarketplace && booking.refundedMinor > 0) {
      // Money GoDND took back after it had already been collected.
      cycleFor(travelEnd).adjustment -= booking.refundedMinor;
    }
  }

  const payouts = [...cycles.entries()]
    .filter(([, cycle]) => cycle.lines.length > 0 || cycle.adjustment !== 0)
    .sort((a, b) => b[1].startMs - a[1].startMs)
    .map(([key, cycle], index) => {
      const grossMinor = cycle.lines.reduce((total, line) => total + line.grossMinor, 0);
      const commissionMinor = cycle.lines.reduce((total, line) => total + line.commissionMinor, 0);
      const netMinor = grossMinor - commissionMinor + cycle.adjustment;
      const settlesAt = cycle.endMs + SETTLEMENT_LAG_DAYS * DAY;

      // The cycle still open is scheduled; the one just closed is moving;
      // anything older has landed.
      const status: PayoutStatus =
        cycle.endMs > nowMs ? "pending" : settlesAt > nowMs ? "processing" : "paid";

      const { label } = financialYear(cycle.startMs);
      return {
        id: `payout-${key}`,
        reference: `PO/${label}/${String(index + 1).padStart(3, "0")}`,
        status,
        // Date strings, as the live `period_start` / `period_end` columns are.
        periodStart: isoDay(cycle.startMs),
        periodEnd: isoDay(cycle.endMs - DAY),
        grossMinor,
        commissionMinor,
        adjustmentMinor: cycle.adjustment,
        netMinor,
        utr: status === "paid" ? utrFor(key) : null,
        paidAt: status === "paid" ? new Date(settlesAt).toISOString() : null,
        expectedAt: status === "paid" ? null : new Date(settlesAt).toISOString(),
        lines: cycle.lines.sort((a, b) => b.grossMinor - a.grossMinor),
      } satisfies Payout;
    });

  return payouts;
}

/** A stable stand-in for the bank's own reference. */
function utrFor(key: string) {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `HDFCN${String(hash).padStart(10, "0").slice(0, 10)}`;
}

/* --------------------------------------------------------------------------
 * Payments
 * ----------------------------------------------------------------------- */

const DIRECT_METHODS: PaymentMethod[] = ["upi", "bank_transfer", "cash", "card"];

/**
 * What actually moved, and when. A travel booking is usually paid twice —
 * a deposit to hold it and the balance before departure — so a fully paid
 * booking shows both rows rather than one lump the operator can't tie to
 * their statement.
 */
export function derivePayments(bookings: DemoBooking[], nowMs: number): PaymentRow[] {
  const payments: PaymentRow[] = [];

  for (const booking of bookings) {
    const createdMs = at(booking.createdAt);
    const method: PaymentMethod = booking.isMarketplace
      ? "razorpay"
      : DIRECT_METHODS[Math.abs(hash(booking.id)) % DIRECT_METHODS.length];

    const base = {
      bookingId: booking.id,
      bookingRef: booking.reference,
      guestName: booking.guestName,
      experienceTitle: booking.experienceTitle,
      method,
      collectedByPlatform: booking.isMarketplace,
    };

    if (booking.paidMinor > 0) {
      const deposit = Math.round(booking.totalMinor * 0.3);
      const paidInFull = booking.paidMinor >= booking.totalMinor;
      const balance = booking.paidMinor - deposit;

      payments.push({
        ...base,
        id: `pay-${booking.id}-1`,
        direction: "inbound",
        status: "captured",
        amountMinor: paidInFull && balance > 0 ? deposit : booking.paidMinor,
        gatewayRef: booking.isMarketplace ? `pay_${hashRef(booking.id, 1)}` : null,
        createdAt: new Date(createdMs + 2 * 3_600_000).toISOString(),
        note: paidInFull && balance > 0 ? "Deposit" : paidInFull ? "Paid in full" : "Part payment",
      });

      if (paidInFull && balance > 0) {
        // The balance lands before departure, or at booking if it was late.
        const balanceMs = Math.min(Math.max(at(booking.travelStart) - 21 * DAY, createdMs + DAY), nowMs);
        payments.push({
          ...base,
          id: `pay-${booking.id}-2`,
          direction: "inbound",
          status: "captured",
          amountMinor: balance,
          gatewayRef: booking.isMarketplace ? `pay_${hashRef(booking.id, 2)}` : null,
          createdAt: new Date(balanceMs).toISOString(),
          note: "Balance",
        });
      }
    }

    if (booking.refundedMinor > 0 && booking.cancelledAt) {
      payments.push({
        ...base,
        id: `pay-${booking.id}-r`,
        direction: "refund",
        status: "refunded",
        amountMinor: booking.refundedMinor,
        gatewayRef: booking.isMarketplace ? `rfnd_${hashRef(booking.id, 3)}` : null,
        createdAt: new Date(Math.min(at(booking.cancelledAt) + 3 * DAY, nowMs)).toISOString(),
        note: booking.refundedMinor < booking.totalMinor ? "Partial refund" : "Full refund",
      });
    }
  }

  return payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const hash = (value: string) => {
  let out = 0;
  for (const character of value) out = (out * 31 + character.charCodeAt(0)) | 0;
  return out;
};

const hashRef = (value: string, salt: number) =>
  Math.abs(hash(`${value}:${salt}`)).toString(36).padStart(9, "0").slice(0, 9);

/* --------------------------------------------------------------------------
 * Invoices
 * ----------------------------------------------------------------------- */

const INVOICED: DemoBooking["status"][] = ["confirmed", "partially_paid", "paid", "completed", "refunded"];

/**
 * A tax invoice for every booking that took money, numbered consecutively
 * inside its financial year — which is what GST requires, and why the
 * series restarts each April rather than running forever.
 *
 * The guest's state decides the split: inside Meghalaya it is CGST plus
 * SGST, anywhere else it is IGST. Cancelled trips are voided by a credit
 * note rather than deleted, because a GST invoice cannot be withdrawn.
 */
export function deriveInvoices(bookings: DemoBooking[], nowMs: number): Invoice[] {
  const eligible = bookings
    .filter((booking) => INVOICED.includes(booking.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const sequence = new Map<string, number>();

  return eligible
    .map((booking) => {
      const issuedMs = at(booking.createdAt);
      const { label } = financialYear(issuedMs);
      const next = (sequence.get(label) ?? 0) + 1;
      sequence.set(label, next);

      const total = booking.totalMinor;
      // The guest pays a GST-inclusive price, so the taxable value is what
      // is left once the 5% is taken back out.
      const taxable = Math.round((total * 10_000) / (10_000 + GST_RATE_BPS));
      const tax = total - taxable;
      const placeOfSupply = stateFor(booking.id);
      const intrastate = placeOfSupply === OPERATOR_STATE;

      const status: InvoiceStatus =
        booking.status === "refunded"
          ? "void"
          : booking.paidMinor >= total
            ? "paid"
            : booking.balanceDueAt && at(booking.balanceDueAt) < nowMs
              ? "overdue"
              : booking.paidMinor > 0
                ? "partially_paid"
                : "issued";

      return {
        id: `inv-${booking.id}`,
        number: `WB/${label}/${String(next).padStart(4, "0")}`,
        bookingId: booking.id,
        bookingRef: booking.reference,
        status,
        billToName: booking.guestName,
        billToEmail: `${booking.guestName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        // Most travellers are individuals with no GSTIN; a company booking has one.
        billToGstin: null,
        placeOfSupply,
        placeOfSupplyName: INDIA_STATES.find((state) => state.value === placeOfSupply)?.label ?? placeOfSupply,
        lines: [
          {
            description: booking.experienceTitle,
            sacCode: SAC_CODE,
            quantity: booking.guests,
            unitPriceMinor: Math.round(taxable / booking.guests),
            taxableMinor: taxable,
          },
        ],
        taxableMinor: taxable,
        taxRateBps: GST_RATE_BPS,
        cgstMinor: intrastate ? Math.round(tax / 2) : 0,
        sgstMinor: intrastate ? tax - Math.round(tax / 2) : 0,
        igstMinor: intrastate ? 0 : tax,
        totalMinor: total,
        amountPaidMinor: booking.paidMinor - booking.refundedMinor,
        issuedAt: booking.createdAt,
        dueAt: booking.balanceDueAt,
        creditNoteFor: booking.status === "refunded" ? `CN/${label}/${String(next).padStart(4, "0")}` : null,
        voidedAt: booking.status === "refunded" ? booking.cancelledAt : null,
        isMarketplace: booking.isMarketplace,
      } satisfies Invoice;
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

/** Stable per booking, so an invoice keeps its place of supply between renders. */
function stateFor(bookingId: string) {
  const weighted = ["WB", "ML", "DL", "MH", "KA", "AS", "TN", "GJ", "UP", "TS"];
  return weighted[Math.abs(hash(bookingId)) % weighted.length];
}

/* --------------------------------------------------------------------------
 * Refunds
 * ----------------------------------------------------------------------- */

export function deriveRefunds(bookings: DemoBooking[]): RefundRow[] {
  return bookings
    .filter((booking) => booking.cancelledAt && (booking.refundOwedMinor > 0 || booking.refundedMinor > 0))
    .map((booking) => ({
      bookingId: booking.id,
      bookingRef: booking.reference,
      guestName: booking.guestName,
      experienceTitle: booking.experienceTitle,
      amountMinor: booking.refundOwedMinor > 0 ? booking.refundOwedMinor : booking.refundedMinor,
      cancelledAt: booking.cancelledAt!,
      refundedAt:
        booking.refundOwedMinor > 0
          ? null
          : new Date(at(booking.cancelledAt!) + 3 * DAY).toISOString(),
      isMarketplace: booking.isMarketplace,
    }))
    // Owed first, oldest of those first: the list is a queue, not an archive.
    .sort((a, b) => {
      if ((a.refundedAt === null) !== (b.refundedAt === null)) return a.refundedAt === null ? -1 : 1;
      return a.refundedAt === null
        ? a.cancelledAt.localeCompare(b.cancelledAt)
        : b.cancelledAt.localeCompare(a.cancelledAt);
    });
}

/* --------------------------------------------------------------------------
 * Summary
 * ----------------------------------------------------------------------- */

const OWES_BALANCE: DemoBooking["status"][] = ["pending_payment", "confirmed", "partially_paid"];

export function summariseMoney(
  bookings: DemoBooking[],
  payouts: Payout[],
  payments: PaymentRow[],
  window: Window,
  nowMs: number,
): MoneySummary {
  const paidIn = (start: number, end: number) =>
    payouts
      .filter((payout) => payout.status === "paid" && within(at(payout.paidAt), start, end))
      .reduce((total, payout) => total + payout.netMinor, 0);

  const commission = payouts
    .filter((payout) => payout.status === "paid" && within(at(payout.paidAt), window.startMs, window.endMs))
    .reduce((total, payout) => total + payout.commissionMinor, 0);

  const awaiting = payouts
    .filter((payout) => payout.status === "pending" || payout.status === "processing")
    .reduce((total, payout) => total + payout.netMinor, 0);

  const nextPayout = payouts
    .filter((payout) => payout.expectedAt !== null)
    .sort((a, b) => at(a.expectedAt) - at(b.expectedAt))[0];

  const directCollected = payments
    .filter(
      (payment) =>
        !payment.collectedByPlatform &&
        payment.direction === "inbound" &&
        within(at(payment.createdAt), window.startMs, window.endMs),
    )
    .reduce((total, payment) => total + payment.amountMinor, 0);

  const owing = bookings.filter(
    (booking) => OWES_BALANCE.includes(booking.status) && booking.totalMinor > booking.paidMinor,
  );
  const overdue = owing.filter((booking) => booking.balanceDueAt && at(booking.balanceDueAt) < nowMs);
  const outstanding = (rows: DemoBooking[]) =>
    rows.reduce((total, booking) => total + (booking.totalMinor - booking.paidMinor), 0);

  const owedRefunds = bookings.filter((booking) => booking.refundOwedMinor > 0);

  return {
    paidOutMinor: paidIn(window.startMs, window.endMs),
    paidOutPreviousMinor: paidIn(window.previousStartMs, window.previousEndMs),
    commissionMinor: commission,
    awaitingPayoutMinor: awaiting,
    nextPayoutOn: nextPayout?.expectedAt ?? null,
    directCollectedMinor: directCollected,
    dueFromGuestsMinor: outstanding(owing),
    overdueFromGuestsMinor: outstanding(overdue),
    overdueCount: overdue.length,
    refundsOwedMinor: owedRefunds.reduce((total, booking) => total + booking.refundOwedMinor, 0),
    refundsOwedCount: owedRefunds.length,
  };
}
