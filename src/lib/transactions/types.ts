/**
 * Money, from the operator's side.
 *
 * Two paths run through this screen and they answer different questions:
 *
 *   Marketplace — GoDND collects from the traveller, keeps its commission
 *   and settles the rest on a cycle. The operator's question is "when does
 *   GoDND pay me, and does the amount match my bank statement?"
 *
 *   Direct — the operator collected it themselves on their own site, in
 *   cash or by UPI. No commission, no payout; the money is already theirs.
 *   Their question is "who still owes me?"
 *
 * A single undifferentiated ledger hides that difference, so the summary
 * and the tabs keep them apart.
 */

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "on_hold";

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: "Scheduled",
  processing: "In transit",
  paid: "Paid",
  failed: "Failed",
  on_hold: "On hold",
};

export type PayoutLine = {
  bookingId: string;
  reference: string;
  guestName: string;
  experienceTitle: string;
  travelEnd: string;
  grossMinor: number;
  commissionMinor: number;
  netMinor: number;
};

export type Payout = {
  id: string;
  reference: string;
  status: PayoutStatus;
  periodStart: string;
  periodEnd: string;
  grossMinor: number;
  commissionMinor: number;
  /** Refunds clawed back from this cycle; negative. */
  adjustmentMinor: number;
  netMinor: number;
  /** Bank reference once it has actually moved. */
  utr: string | null;
  /** When it was paid, or when it is expected. */
  paidAt: string | null;
  expectedAt: string | null;
  lines: PayoutLine[];
};

export type PaymentMethod = "razorpay" | "upi" | "card" | "netbanking" | "bank_transfer" | "cash";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "Razorpay",
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export type PaymentRow = {
  id: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  experienceTitle: string;
  direction: "inbound" | "refund";
  method: PaymentMethod;
  status: "captured" | "refunded" | "failed";
  amountMinor: number;
  /** GoDND collected it (marketplace) rather than the operator. */
  collectedByPlatform: boolean;
  gatewayRef: string | null;
  createdAt: string;
  /** What this payment was for — a deposit, the balance, or a refund. */
  note: string;
};

export type InvoiceStatus = "issued" | "paid" | "partially_paid" | "overdue" | "void";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Issued",
  paid: "Paid",
  partially_paid: "Part-paid",
  overdue: "Overdue",
  void: "Cancelled",
};

export type InvoiceLine = {
  description: string;
  /** Services Accounting Code — 9985 is tour operator services. */
  sacCode: string;
  quantity: number;
  unitPriceMinor: number;
  taxableMinor: number;
};

export type Invoice = {
  id: string;
  /** Consecutive within the financial year, as GST requires. */
  number: string;
  bookingId: string;
  bookingRef: string;
  status: InvoiceStatus;
  billToName: string;
  billToEmail: string | null;
  billToGstin: string | null;
  /** State code; decides CGST+SGST against IGST. */
  placeOfSupply: string;
  placeOfSupplyName: string;
  lines: InvoiceLine[];
  taxableMinor: number;
  taxRateBps: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  issuedAt: string;
  dueAt: string | null;
  /** Set when the trip was cancelled: a GST invoice is credited, never deleted. */
  creditNoteFor: string | null;
  voidedAt: string | null;
  isMarketplace: boolean;
};

export type RefundRow = {
  bookingId: string;
  bookingRef: string;
  guestName: string;
  experienceTitle: string;
  /** What the guest was promised back. */
  amountMinor: number;
  cancelledAt: string;
  /** Null while it is still owed. */
  refundedAt: string | null;
  isMarketplace: boolean;
};

export type MoneySummary = {
  /** Settled into the operator's bank inside the period. */
  paidOutMinor: number;
  paidOutPreviousMinor: number;
  /** GoDND's take out of what it settled in the period. */
  commissionMinor: number;
  /** Held by GoDND, not yet settled. */
  awaitingPayoutMinor: number;
  nextPayoutOn: string | null;
  /** Collected by the operator directly inside the period — theirs already. */
  directCollectedMinor: number;
  /** Balances guests still owe on live bookings. */
  dueFromGuestsMinor: number;
  overdueFromGuestsMinor: number;
  overdueCount: number;
  /** Promised back and not yet sent. */
  refundsOwedMinor: number;
  refundsOwedCount: number;
};

export const TRANSACTION_TABS = [
  { key: "payouts", label: "Payouts" },
  { key: "payments", label: "Payments" },
  { key: "invoices", label: "Invoices" },
  { key: "refunds", label: "Refunds" },
] as const;

export type TransactionTab = (typeof TRANSACTION_TABS)[number]["key"];

export const isTransactionTab = (value: unknown): value is TransactionTab =>
  TRANSACTION_TABS.some((tab) => tab.key === value);

/**
 * Periods an accountant asks for. Rolling 30 days for a cash-flow check;
 * the rest are the Indian financial year's own boundaries, because that is
 * what a GST return and a year-end are filed against.
 */
export const TRANSACTION_PERIODS = [
  { key: "30d", label: "Last 30 days" },
  { key: "quarter", label: "This quarter" },
  { key: "fy", label: "This financial year" },
  { key: "all", label: "All time" },
] as const;

export type TransactionPeriod = (typeof TRANSACTION_PERIODS)[number]["key"];

export const isTransactionPeriod = (value: unknown): value is TransactionPeriod =>
  TRANSACTION_PERIODS.some((period) => period.key === value);
