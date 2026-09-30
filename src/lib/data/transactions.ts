import "server-only";

import { connection } from "next/server";

import { demoBookings } from "@/lib/insights/demo";
import { can, type Capability } from "@/lib/settings/rules";
import type { Role } from "@/lib/settings/options";
import {
  derivePayments,
  deriveInvoices,
  derivePayouts,
  deriveRefunds,
  periodWindow,
  summariseMoney,
} from "@/lib/transactions/derive";
import type {
  Invoice,
  MoneySummary,
  PaymentRow,
  Payout,
  RefundRow,
  TransactionPeriod,
} from "@/lib/transactions/types";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Data access for Transactions.
 *
 * Live, each kind of row has its own table, written by code the operator
 * doesn't control: the payment gateway writes payments, the settlement job
 * writes payouts. The sample workspace derives all of it from the same
 * bookings Insights counts, so the two screens can never disagree.
 */

export const isTransactionsDemo = () =>
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type BankDestination = {
  accountName: string;
  last4: string | null;
  ifsc: string | null;
  bankName: string | null;
  verifiedAt: string | null;
};

export type TransactionsData = {
  summary: MoneySummary;
  payouts: Payout[];
  payments: PaymentRow[];
  invoices: Invoice[];
  refunds: RefundRow[];
  /** Null when this role may not see where the money lands. */
  bank: BankDestination | null;
  /** Payouts are held until GoDND has verified the account. */
  bankVerified: boolean;
  canSeeBank: boolean;
  period: TransactionPeriod;
  periodLabel: string;
  isDemoData: boolean;
};

export async function getTransactions(period: TransactionPeriod): Promise<TransactionsData> {
  await connection();
  const now = Date.now();
  const window = periodWindow(period, now);

  if (isTransactionsDemo()) {
    const bookings = demoBookings(now);
    const payouts = derivePayouts(bookings, now);
    const payments = derivePayments(bookings, now);
    return {
      summary: summariseMoney(bookings, payouts, payments, window, now),
      payouts,
      payments,
      invoices: deriveInvoices(bookings, now),
      refunds: deriveRefunds(bookings),
      // The sample workspace's Settings has Financial Details unsubmitted,
      // so the screen shows the held-payout state the operator would hit.
      bank: null,
      bankVerified: false,
      canSeeBank: true,
      period,
      periodLabel: window.label,
      isDemoData: true,
    };
  }

  return liveTransactions(period, window, now);
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** A Postgrest row. The mappers below narrow each field as they read it. */
type Row = Record<string, unknown>;

async function liveTransactions(
  period: TransactionPeriod,
  window: ReturnType<typeof periodWindow>,
  now: number,
): Promise<TransactionsData> {
  const supabase = await createServerSupabase();
  const role = await viewerRole(supabase);
  const canSeeBank = role !== null && can(role, "view_financial" as Capability);

  const [payoutRows, paymentRows, invoiceRows, bookingRows, bankRows] = await Promise.all([
    supabase
      .from("payouts")
      .select(
        "id, reference, status, period_start, period_end, gross_minor, commission_minor, adjustment_minor, " +
          "net_minor, utr, paid_at, created_at, " +
          "items:payout_items ( booking_id, gross_minor, commission_minor, net_minor, " +
          "booking:bookings ( reference, lead_name, travel_end, experience_snapshot ) )",
      )
      .order("period_end", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, booking_id, direction, status, amount_minor, method, gateway_payment_id, collected_by_platform, " +
          "paid_at, created_at, booking:bookings ( reference, lead_name )",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("invoices")
      .select(
        "id, number, booking_id, status, bill_to_name, bill_to_email, bill_to_gstin, place_of_supply, " +
          "line_items, subtotal_minor, cgst_minor, sgst_minor, igst_minor, total_minor, amount_paid_minor, " +
          "issued_at, due_at, voided_at, booking:bookings ( reference, is_marketplace )",
      )
      .order("issued_at", { ascending: false })
      .limit(2000),
    supabase
      .from("bookings")
      .select(
        "id, reference, lead_name, status, is_marketplace, total_minor, paid_minor, refunded_minor, " +
          "refund_owed_minor, commission_minor, balance_due_at, cancelled_at, created_at, travel_start, travel_end",
      )
      .neq("status", "draft"),
    canSeeBank
      ? supabase
          .from("agency_bank_accounts")
          .select("account_name, account_last4, ifsc, bank_name, verified_at")
          .eq("is_primary", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  for (const result of [payoutRows, paymentRows, invoiceRows, bookingRows]) {
    if (result.error) throw new Error(`Failed to load Transactions: ${result.error.message}`);
  }

  const payouts = mapPayouts((payoutRows.data ?? []) as unknown as Row[], now);
  const payments = mapPayments((paymentRows.data ?? []) as unknown as Row[]);
  const bookings = mapBookings((bookingRows.data ?? []) as unknown as Row[]);
  const bank = bankRows.data
    ? {
        accountName: bankRows.data.account_name as string,
        last4: (bankRows.data.account_last4 as string) ?? null,
        ifsc: (bankRows.data.ifsc as string) ?? null,
        bankName: (bankRows.data.bank_name as string) ?? null,
        verifiedAt: (bankRows.data.verified_at as string) ?? null,
      }
    : null;

  return {
    summary: summariseMoney(bookings, payouts, payments, window, now),
    payouts,
    payments,
    invoices: mapInvoices((invoiceRows.data ?? []) as unknown as Row[]),
    refunds: deriveRefunds(bookings),
    bank,
    bankVerified: Boolean(bank?.verifiedAt),
    canSeeBank,
    period,
    periodLabel: window.label,
    isDemoData: false,
  };
}

async function viewerRole(supabase: Supabase): Promise<Role | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("agency_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.role as Role) ?? null;
}

/* --------------------------------------------------------------------------
 * Row mapping. The shapes match what derive.ts produces, so the screen has
 * one contract whichever path filled it.
 * ----------------------------------------------------------------------- */

const SETTLEMENT_LAG = 5 * 86_400_000;

function mapPayouts(rows: Row[], now: number): Payout[] {
  return rows.map((row) => {
    const items = (row.items ?? []) as Row[];
    const periodEnd = Date.parse(row.period_end as string);
    const expected = periodEnd + 86_400_000 + SETTLEMENT_LAG;
    const status = row.status as Payout["status"];
    return {
      id: row.id as string,
      reference: row.reference as string,
      status,
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      grossMinor: (row.gross_minor as number) ?? 0,
      commissionMinor: (row.commission_minor as number) ?? 0,
      adjustmentMinor: (row.adjustment_minor as number) ?? 0,
      netMinor: (row.net_minor as number) ?? 0,
      utr: (row.utr as string) ?? null,
      paidAt: (row.paid_at as string) ?? null,
      expectedAt: status === "paid" ? null : new Date(Math.max(expected, now)).toISOString(),
      lines: items.map((item) => {
        const booking = item.booking as Row | null;
        const snapshot = (booking?.experience_snapshot ?? {}) as Row;
        return {
          bookingId: item.booking_id as string,
          reference: (booking?.reference as string) ?? "—",
          guestName: (booking?.lead_name as string) ?? "Guest",
          experienceTitle: (snapshot.title as string) ?? "Experience",
          travelEnd: (booking?.travel_end as string) ?? (row.period_end as string),
          grossMinor: item.gross_minor as number,
          commissionMinor: item.commission_minor as number,
          netMinor: item.net_minor as number,
        };
      }),
    };
  });
}

const METHODS = new Set(["razorpay", "upi", "card", "netbanking", "bank_transfer", "cash"]);

function mapPayments(rows: Row[]): PaymentRow[] {
  return rows.map((row) => {
    const booking = row.booking as Row | null;
    const method = String(row.method ?? "razorpay");
    const direction = row.direction as "inbound" | "refund";
    return {
      id: row.id as string,
      bookingId: (row.booking_id as string) ?? "",
      bookingRef: (booking?.reference as string) ?? "—",
      guestName: (booking?.lead_name as string) ?? "Guest",
      experienceTitle: "",
      direction,
      method: (METHODS.has(method) ? method : "razorpay") as PaymentRow["method"],
      status: row.status === "refunded" ? "refunded" : row.status === "failed" ? "failed" : "captured",
      amountMinor: row.amount_minor as number,
      collectedByPlatform: Boolean(row.collected_by_platform),
      gatewayRef: (row.gateway_payment_id as string) ?? null,
      createdAt: (row.paid_at as string) ?? (row.created_at as string),
      note: direction === "refund" ? "Refund" : "Payment",
    };
  });
}

function mapInvoices(rows: Row[]): Invoice[] {
  return rows.map((row) => {
    const booking = row.booking as Row | null;
    const lines = (row.line_items ?? []) as Row[];
    const taxable = (row.subtotal_minor as number) ?? 0;
    const cgst = (row.cgst_minor as number) ?? 0;
    const igst = (row.igst_minor as number) ?? 0;
    return {
      id: row.id as string,
      number: row.number as string,
      bookingId: (row.booking_id as string) ?? "",
      bookingRef: (booking?.reference as string) ?? "—",
      status: (row.status === "draft" ? "issued" : row.status) as Invoice["status"],
      billToName: row.bill_to_name as string,
      billToEmail: (row.bill_to_email as string) ?? null,
      billToGstin: (row.bill_to_gstin as string) ?? null,
      placeOfSupply: (row.place_of_supply as string) ?? "",
      placeOfSupplyName: (row.place_of_supply as string) ?? "",
      lines: lines.map((line) => ({
        description: String(line.description ?? ""),
        sacCode: String(line.hsn_sac ?? "9985"),
        quantity: Number(line.qty ?? 1),
        unitPriceMinor: Number(line.unit_price_minor ?? 0),
        taxableMinor: Number(line.amount_minor ?? 0),
      })),
      taxableMinor: taxable,
      taxRateBps: taxable > 0 ? Math.round(((cgst * 2 + igst) / taxable) * 10_000) : 0,
      cgstMinor: cgst,
      sgstMinor: (row.sgst_minor as number) ?? 0,
      igstMinor: igst,
      totalMinor: (row.total_minor as number) ?? 0,
      amountPaidMinor: (row.amount_paid_minor as number) ?? 0,
      issuedAt: (row.issued_at as string) ?? (row.created_at as string),
      dueAt: (row.due_at as string) ?? null,
      creditNoteFor: null,
      voidedAt: (row.voided_at as string) ?? null,
      isMarketplace: Boolean(booking?.is_marketplace),
    };
  });
}

function mapBookings(rows: Row[]) {
  return rows.map((row) => ({
    id: row.id as string,
    reference: row.reference as string,
    guestName: (row.lead_name as string) ?? "Guest",
    experienceId: "",
    experienceTitle: "",
    status: row.status as never,
    isMarketplace: Boolean(row.is_marketplace),
    guests: 1,
    totalMinor: (row.total_minor as number) ?? 0,
    commissionBps: 0,
    commissionMinor: (row.commission_minor as number) ?? 0,
    createdAt: row.created_at as string,
    travelStart: (row.travel_start as string) ?? (row.created_at as string),
    travelEnd: (row.travel_end as string) ?? (row.created_at as string),
    paidMinor: (row.paid_minor as number) ?? 0,
    refundedMinor: (row.refunded_minor as number) ?? 0,
    refundOwedMinor: (row.refund_owed_minor as number) ?? 0,
    balanceDueAt: (row.balance_due_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
  }));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const data = await getTransactions("all");
  return data.invoices.find((invoice) => invoice.id === id) ?? null;
}
