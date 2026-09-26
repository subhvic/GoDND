"use client";

import { useId, useState } from "react";
import { AlertTriangle, Printer, Star } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { newMessageId as newId } from "@/lib/enquiries/ids";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type BookingActionDraft,
} from "@/lib/bookings/actions";
import {
  CANCEL_CATEGORY_LABELS,
  balanceMinor,
  guestCount,
  phaseForBooking,
  policyRefund,
  tripDay,
} from "@/lib/bookings/phase";
import { addDays, daysFrom, formatDay, formatDayFull, formatDayRange } from "@/lib/time";
import type { BookingDetail, BookingTraveller, CancelCategory } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/*
 * The drawer's journeys (docs/BOOKING-JOURNEYS.md §4). Each dialog builds an
 * action, hands it to `run` — which applies it at once and confirms it with
 * the server — and closes on success. A refusal ("That's more than the
 * ₹49,000 due") comes back as a sentence and stays in the dialog.
 */

type Run = (draft: BookingActionDraft) => Promise<string | null>;

type Common = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BookingDetail;
  today: string;
  run: Run;
  onDone: (message: string) => void;
};

const rupees = (value: string) => (Number.parseInt(value.replace(/[^\d]/g, ""), 10) || 0) * 100;
const toRupees = (minor: number) => String(Math.round(minor / 100));
const firstName = (name: string) => name.trim().split(/\s+/)[0];

function Footer({ formId, label, danger, onCancel, disabled }: { formId: string; label: string; danger?: boolean; onCancel: () => void; disabled?: boolean }) {
  return (
    <>
      <button type="button" className={buttonClass()} onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={disabled} className={buttonClass({ variant: danger ? "danger" : "primary", className: danger ? "danger-solid" : undefined })}>
        {label}
      </button>
    </>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="dialog-error">
      <AlertTriangle aria-hidden />
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------------ */
/* J2 Record payment                                                        */
/* ------------------------------------------------------------------------ */

export function PaymentDialog({ open, onOpenChange, detail, today, run, onDone }: Common) {
  const formId = useId();
  const due = balanceMinor(detail);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record a payment"
      description="For money the guest paid you directly — UPI, bank transfer or cash. Online payments are recorded automatically."
      footer={<Footer formId={formId} label="Record payment" onCancel={() => onOpenChange(false)} />}
    >
      <PaymentForm formId={formId} detail={detail} today={today} due={due} run={run} onSaved={(message) => { onOpenChange(false); onDone(message); }} />
    </Dialog>
  );
}

function PaymentForm({ formId, detail, today, due, run, onSaved }: { formId: string; detail: BookingDetail; today: string; due: number; run: Run; onSaved: (message: string) => void }) {
  const [amount, setAmount] = useState(toRupees(due));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("upi");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const amountMinor = rupees(amount);
  const after = Math.max(due - amountMinor, 0);
  const needsReference = method === "upi" || method === "bank_transfer";

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-[14px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (amountMinor <= 0) next.amount = "Enter the amount received";
        else if (amountMinor > due) next.amount = `At most ${formatMoney(due, detail.currency)} is due`;
        if (needsReference && !reference.trim()) next.reference = "Add the transaction reference so it can be matched later";
        if (receivedOn > today) next.receivedOn = "That date is in the future";
        setErrors(next);
        if (Object.keys(next).length) return;
        const failed = await run({ type: "record_payment", paymentId: newId(), amountMinor, method, reference: reference.trim() || null, receivedOn });
        if (failed) setFailure(failed);
        else onSaved(`${formatMoney(amountMinor, detail.currency)} recorded`);
      }}
    >
      <FormError message={failure} />
      <Field label="Amount received" required error={errors.amount} hint={`${formatMoney(due, detail.currency)} is due`}>
        {({ id, describedBy, invalid }) => (
          <AffixInput id={id} prefix="₹" inputMode="numeric" describedBy={describedBy} invalid={invalid} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} />
        )}
      </Field>
      <div className="form-grid-2">
        <Field label="How it was paid">
          {({ id }) => (
            <Select id={id} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Received on" error={errors.receivedOn}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} type="date" max={today} describedBy={describedBy} invalid={invalid} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
          )}
        </Field>
      </div>
      <Field label={needsReference ? "Transaction reference" : "Receipt or note"} required={needsReference} error={errors.reference} hint={needsReference ? "UPI reference or NEFT/IMPS number" : "Optional"}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} describedBy={describedBy} invalid={invalid} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} />
        )}
      </Field>
      <p className="dialog-summary">
        {amountMinor > 0 && amountMinor <= due
          ? after === 0
            ? `Paid in full after this.${detail.status === "pending_payment" ? " The booking is confirmed and moves to Upcoming." : ""}`
            : `${formatMoney(after, detail.currency)} will still be due.${detail.status === "pending_payment" ? " The booking is confirmed and moves to Upcoming." : ""}`
          : " "}
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* J4 Refund                                                                */
/* ------------------------------------------------------------------------ */

export function RefundDialog({ open, onOpenChange, detail, today, run, onDone }: Common) {
  const formId = useId();
  const goodwill = detail.refundOwedMinor === 0;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={goodwill ? "Issue a refund" : "Record the refund"}
      description={
        goodwill
          ? "A goodwill refund on top of the booking — say why, it goes on the record."
          : `Record the ${formatMoney(detail.refundOwedMinor, detail.currency)} once you've sent it to ${firstName(detail.leadName)}.`
      }
      footer={<Footer formId={formId} label="Record refund" onCancel={() => onOpenChange(false)} />}
    >
      <RefundForm formId={formId} detail={detail} today={today} goodwill={goodwill} run={run} onSaved={(message) => { onOpenChange(false); onDone(message); }} />
    </Dialog>
  );
}

function RefundForm({ formId, detail, goodwill, run, onSaved }: { formId: string; detail: BookingDetail; today: string; goodwill: boolean; run: Run; onSaved: (message: string) => void }) {
  const refundable = detail.paidMinor - detail.refundedMinor;
  const [amount, setAmount] = useState(toRupees(goodwill ? 0 : detail.refundOwedMinor));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("upi");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const amountMinor = rupees(amount);

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-[14px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (amountMinor <= 0) next.amount = "Enter the amount refunded";
        else if (amountMinor > refundable) next.amount = `At most ${formatMoney(refundable, detail.currency)} was paid`;
        if (goodwill && !reason.trim()) next.reason = "Say why — it goes on the booking's record";
        setErrors(next);
        if (Object.keys(next).length) return;
        const failed = await run({ type: "record_refund", paymentId: newId(), amountMinor, method, reference: reference.trim() || null, reason: reason.trim() || null });
        if (failed) setFailure(failed);
        else onSaved(`${formatMoney(amountMinor, detail.currency)} refund recorded`);
      }}
    >
      <FormError message={failure} />
      <Field label="Amount refunded" required error={errors.amount} hint={`${formatMoney(refundable, detail.currency)} paid and not yet refunded`}>
        {({ id, describedBy, invalid }) => (
          <AffixInput id={id} prefix="₹" inputMode="numeric" describedBy={describedBy} invalid={invalid} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} />
        )}
      </Field>
      <div className="form-grid-2">
        <Field label="Sent by">
          {({ id }) => (
            <Select id={id} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference" hint="Optional">
          {({ id, describedBy }) => <TextInput id={id} describedBy={describedBy} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} />}
        </Field>
      </div>
      <Field label="Reason" required={goodwill} error={errors.reason}>
        {({ id, describedBy, invalid }) => <TextInput id={id} describedBy={describedBy} invalid={invalid} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />}
      </Field>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* J3 Cancel booking                                                        */
/* ------------------------------------------------------------------------ */

export function CancelDialog({ open, onOpenChange, detail, today, run, onDone }: Common) {
  const formId = useId();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmed(false);
        onOpenChange(next);
      }}
      size="md"
      title={`Cancel ${detail.reference}?`}
      description={`${detail.leadName} · ${detail.experienceTitle}`}
      footer={<Footer formId={formId} label="Cancel booking" danger disabled={!confirmed} onCancel={() => onOpenChange(false)} />}
    >
      <CancelForm formId={formId} detail={detail} today={today} run={run} confirmed={confirmed} setConfirmed={setConfirmed} onSaved={(message) => { onOpenChange(false); onDone(message); }} />
    </Dialog>
  );
}

function CancelForm({
  formId,
  detail,
  today,
  run,
  confirmed,
  setConfirmed,
  onSaved,
}: {
  formId: string;
  detail: BookingDetail;
  today: string;
  run: Run;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const paid = detail.paidMinor - detail.refundedMinor;
  const categories = (Object.keys(CANCEL_CATEGORY_LABELS) as CancelCategory[]).filter(
    (category) => category !== "no_payment" || paid === 0,
  );
  const [category, setCategory] = useState<CancelCategory>(paid === 0 ? "no_payment" : "guest_request");
  const [reason, setReason] = useState("");
  const policy = policyRefund(detail, category, today);
  const [override, setOverride] = useState<string | null>(null);
  const refundMinor = override === null ? policy.amountMinor : rupees(override);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const name = useId();
  const differs = override !== null && refundMinor !== policy.amountMinor;

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-[16px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (!reason.trim()) next.reason = "Say briefly why — it stays on the booking";
        if (refundMinor > paid) next.refund = `At most ${formatMoney(paid, detail.currency)} was paid`;
        setErrors(next);
        if (Object.keys(next).length || !confirmed) return;
        const failed = await run({ type: "cancel", category, reason: reason.trim(), refundMinor });
        if (failed) setFailure(failed);
        else onSaved(refundMinor > 0 ? `Cancelled — ${formatMoney(refundMinor, detail.currency)} refund due` : "Booking cancelled");
      }}
    >
      <FormError message={failure} />
      <fieldset className="m-0 border-0 p-0">
        <legend className="field-label mb-[8px]">Why is it being cancelled?</legend>
        <div className="choice-list">
          {categories.map((value) => (
            <label key={value} className="choice-option">
              <input type="radio" name={name} value={value} checked={category === value} onChange={() => { setCategory(value); setOverride(null); }} />
              <span>{CANCEL_CATEGORY_LABELS[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Details" required error={errors.reason} hint="Kept on the booking and shown in the Cancelled list">
        {({ id, describedBy, invalid }) => (
          <TextArea id={id} rows={2} className="min-h-[60px]" describedBy={describedBy} invalid={invalid} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
        )}
      </Field>

      {paid > 0 ? (
        <div className="refund-box">
          <p className="refund-box-title">Refund</p>
          <p className="refund-box-rule">
            {policy.rule} · {formatMoney(paid, detail.currency)} paid
          </p>
          <Field label="Refund to the guest" error={errors.refund} hint={differs ? "Differs from the policy — the reason above explains why" : `Policy amount: ${formatMoney(policy.amountMinor, detail.currency)}`}>
            {({ id, describedBy, invalid }) => (
              <AffixInput id={id} prefix="₹" inputMode="numeric" describedBy={describedBy} invalid={invalid} value={override ?? toRupees(policy.amountMinor)} onChange={(event) => setOverride(event.target.value.replace(/[^\d]/g, ""))} />
            )}
          </Field>
          <p className="refund-box-note">
            {refundMinor === 0
              ? `${formatMoney(paid, detail.currency)} is kept.`
              : detail.isMarketplace
                ? "GoDND refunds marketplace bookings to the guest's original payment method in 5–7 working days."
                : "You send this refund yourself, then record it on the booking."}
          </p>
        </div>
      ) : (
        <p className="dialog-summary">No payment was taken, so there is nothing to refund.</p>
      )}

      <Checkbox
        checked={confirmed}
        onChange={setConfirmed}
        label={`I've told ${firstName(detail.leadName)}, and I understand a cancellation can't be undone. The seats become available to other bookings.`}
      />
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* J5 Traveller                                                             */
/* ------------------------------------------------------------------------ */

export function TravellerDialog({
  open,
  onOpenChange,
  detail,
  traveller,
  run,
  onDone,
}: Omit<Common, "today"> & { traveller: BookingTraveller | null }) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={traveller ? `Edit ${traveller.fullName}` : "Add a traveller"}
      description={detail.permitStatus !== "not_needed" ? "An ID number is needed for every adult to apply for the Inner Line Permit." : "Names and IDs go on the guest manifest the trip captain carries."}
      footer={<Footer formId={formId} label="Save" onCancel={() => onOpenChange(false)} />}
    >
      <TravellerForm formId={formId} detail={detail} traveller={traveller} run={run} onSaved={(message) => { onOpenChange(false); onDone(message); }} />
    </Dialog>
  );
}

function TravellerForm({ formId, detail, traveller, run, onSaved }: { formId: string; detail: BookingDetail; traveller: BookingTraveller | null; run: Run; onSaved: (message: string) => void }) {
  const [fullName, setFullName] = useState(traveller?.fullName ?? "");
  const [ageBucket, setAgeBucket] = useState<BookingTraveller["ageBucket"]>(traveller?.ageBucket ?? "adult");
  const [idType, setIdType] = useState<string>(traveller?.idType ?? "");
  const [idNumber, setIdNumber] = useState(traveller?.idNumber ?? "");
  const [mealPref, setMealPref] = useState(traveller?.mealPref ?? "");
  const [medicalNotes, setMedicalNotes] = useState(traveller?.medicalNotes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const meals = useId();
  const name = useId();

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-[14px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (!fullName.trim()) next.fullName = "Enter the traveller's name";
        if (idType && !idNumber.trim()) next.idNumber = "Add the number, or choose “No ID yet”";
        setErrors(next);
        if (Object.keys(next).length) return;
        const failed = await run({
          type: "update_traveller",
          traveller: {
            id: traveller?.id ?? newId(),
            fullName: fullName.trim(),
            ageBucket,
            role: traveller?.role ?? (detail.travellers.length === 0 ? "lead" : "guest"),
            idType: (idType || null) as BookingTraveller["idType"],
            idNumber: idType ? idNumber.trim() : null,
            mealPref: mealPref.trim() || null,
            medicalNotes: medicalNotes.trim() || null,
            checkedInAt: traveller?.checkedInAt ?? null,
          },
        });
        if (failed) setFailure(failed);
        else onSaved(traveller ? "Traveller updated" : `${fullName.trim()} added`);
      }}
    >
      <FormError message={failure} />
      <Field label="Full name" required error={errors.fullName} hint="As on their ID">
        {({ id, describedBy, invalid }) => <TextInput id={id} describedBy={describedBy} invalid={invalid} autoComplete="off" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />}
      </Field>
      <fieldset className="m-0 border-0 p-0">
        <legend className="field-label mb-[6px]">Age group</legend>
        <div className="choice-group">
          {(["adult", "child", "infant"] as const).map((value) => (
            <label key={value} className="check-row items-center">
              <input type="radio" name={name} className="mt-0" checked={ageBucket === value} onChange={() => setAgeBucket(value)} />
              <span>{value === "adult" ? "Adult (12+)" : value === "child" ? "Child (2–11)" : "Infant (under 2)"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid-2">
        <Field label="Photo ID">
          {({ id }) => (
            <Select id={id} value={idType} onChange={(event) => setIdType(event.target.value)}>
              <option value="">No ID yet</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="passport">Passport</option>
              <option value="voter">Voter ID</option>
              <option value="dl">Driving licence</option>
            </Select>
          )}
        </Field>
        <Field label="ID number" error={errors.idNumber} hint={idType === "aadhaar" ? "Last 4 digits are enough" : undefined}>
          {({ id, describedBy, invalid }) => <TextInput id={id} describedBy={describedBy} invalid={invalid} disabled={!idType} autoComplete="off" maxLength={32} value={idNumber} onChange={(event) => setIdNumber(event.target.value)} />}
        </Field>
      </div>
      <Field label="Food preference" hint="Optional">
        {({ id, describedBy }) => (
          <>
            <TextInput id={id} describedBy={describedBy} list={meals} maxLength={60} value={mealPref} onChange={(event) => setMealPref(event.target.value)} />
            <datalist id={meals}>
              <option value="Vegetarian" />
              <option value="Vegan" />
              <option value="Jain" />
              <option value="Non-vegetarian" />
              <option value="No nuts — allergy" />
            </datalist>
          </>
        )}
      </Field>
      <Field label="Medical notes" hint="Anything the trip captain should know — shown on the trip's first screen">
        {({ id, describedBy }) => <TextArea id={id} rows={2} className="min-h-[56px]" describedBy={describedBy} maxLength={300} value={medicalNotes} onChange={(event) => setMedicalNotes(event.target.value)} />}
      </Field>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* J8 Change dates                                                          */
/* ------------------------------------------------------------------------ */

export function DatesDialog({ open, onOpenChange, detail, today, run, onDone }: Common) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Change dates"
      description="Check the new dates are open for this experience before you confirm them with the guest."
      footer={<Footer formId={formId} label="Change dates" onCancel={() => onOpenChange(false)} />}
    >
      <DatesForm formId={formId} detail={detail} today={today} run={run} onSaved={(message) => { onOpenChange(false); onDone(message); }} />
    </Dialog>
  );
}

function DatesForm({ formId, detail, today, run, onSaved }: { formId: string; detail: BookingDetail; today: string; run: Run; onSaved: (message: string) => void }) {
  const length = detail.travelStart && detail.travelEnd ? daysFrom(detail.travelStart, detail.travelEnd) : Math.max((detail.experienceSnapshot.durationDays ?? 1) - 1, 0);
  const [start, setStart] = useState(detail.travelStart && detail.travelStart >= today ? detail.travelStart : addDays(today, 7));
  const [end, setEnd] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const endValue = end ?? addDays(start, length);
  const now = new Date(`${today}T12:00:00+05:30`);

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-[14px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const failed = await run({ type: "change_dates", start, end: endValue, note: note.trim() || null });
        if (failed) setFailure(failed);
        else onSaved(`Dates changed to ${formatDayRange(start, endValue, now)}`);
      }}
    >
      <FormError message={failure} />
      <div className="form-grid-2">
        <Field label="New start" hint={detail.travelStart ? `Now ${formatDayRange(detail.travelStart, detail.travelEnd, now)}` : undefined}>
          {({ id, describedBy }) => <TextInput id={id} type="date" min={today} describedBy={describedBy} value={start} onChange={(event) => { setStart(event.target.value); setEnd(null); setFailure(null); }} />}
        </Field>
        <Field label="New end" hint={end === null ? `Keeps the ${length + 1}-day length` : undefined}>
          {({ id, describedBy }) => <TextInput id={id} type="date" min={start} describedBy={describedBy} value={endValue} onChange={(event) => { setEnd(event.target.value); setFailure(null); }} />}
        </Field>
      </div>
      <Field label="Note" hint="Why the dates moved — kept on the timeline">
        {({ id, describedBy }) => <TextInput id={id} describedBy={describedBy} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />}
      </Field>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* J9 Check in                                                              */
/* ------------------------------------------------------------------------ */

export function CheckInDialog({ open, onOpenChange, detail, run, onDone, only }: Omit<Common, "today"> & { only?: string | null }) {
  const formId = useId();
  const pending = detail.travellers.filter((traveller) => !traveller.checkedInAt);
  const unnamed = Math.max(guestCount(detail) - detail.travellers.length, 0);
  const [selected, setSelected] = useState<string[]>(() => (only ? [only] : pending.map((traveller) => traveller.id)));
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Check in guests"
      description="Tick everyone who has joined the trip."
      footer={<Footer formId={formId} label={selected.length ? `Check in ${selected.length}` : "Check in"} disabled={!selected.length} onCancel={() => onOpenChange(false)} />}
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-[12px]"
        onSubmit={async (event) => {
          event.preventDefault();
          const failed = await run({ type: "check_in", travellerIds: selected });
          if (failed) setFailure(failed);
          else {
            onOpenChange(false);
            onDone(selected.length === 1 ? "Checked in" : `${selected.length} guests checked in`);
          }
        }}
      >
        <FormError message={failure} />
        <div className="choice-list">
          {pending.map((traveller) => (
            <Checkbox
              key={traveller.id}
              className="choice-option"
              checked={selected.includes(traveller.id)}
              onChange={(checked) =>
                setSelected((current) => (checked ? [...current, traveller.id] : current.filter((id) => id !== traveller.id)))
              }
              label={traveller.fullName}
            />
          ))}
        </div>
        {unnamed > 0 ? (
          <p className="dialog-summary">
            {unnamed} seat{unnamed === 1 ? " has" : "s have"} no name yet — add {unnamed === 1 ? "it" : "them"} under Travellers to check in.
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* J10 Trip update                                                          */
/* ------------------------------------------------------------------------ */

export function TripUpdateDialog({ open, onOpenChange, detail, today, run, onDone }: Common) {
  const formId = useId();
  const [kind, setKind] = useState<"trip_update" | "incident">("trip_update");
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const day = tripDay(detail, today);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a trip update"
      description={`Day ${day?.day ?? 1} of ${day?.of ?? 1}. Updates go on the trip log your team sees; the guest isn't messaged.`}
      footer={<Footer formId={formId} label="Add to trip log" onCancel={() => onOpenChange(false)} />}
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-[14px]"
        onSubmit={async (event) => {
          event.preventDefault();
          const next: Record<string, string> = {};
          if (!label.trim()) next.label = "Give it a one-line headline";
          setErrors(next);
          if (Object.keys(next).length) return;
          const failed = await run({ type: "log", kind, label: label.trim(), detail: body.trim() || null });
          if (failed) setFailure(failed);
          else {
            onOpenChange(false);
            onDone(kind === "incident" ? "Incident logged" : "Update added");
          }
        }}
      >
        <FormError message={failure} />
        <div className="seg-toggle self-start" role="group" aria-label="Type">
          <button type="button" className={`seg ${kind === "trip_update" ? "active" : ""}`} aria-pressed={kind === "trip_update"} onClick={() => setKind("trip_update")}>
            Update
          </button>
          <button type="button" className={`seg ${kind === "incident" ? "active" : ""}`} aria-pressed={kind === "incident"} onClick={() => setKind("incident")}>
            Incident
          </button>
        </div>
        <Field label="Headline" required error={errors.label} hint={kind === "incident" ? "e.g. Minor injury on the descent — first aid given" : "e.g. Reached Dirang — everyone well"}>
          {({ id, describedBy, invalid }) => <TextInput id={id} describedBy={describedBy} invalid={invalid} maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} />}
        </Field>
        <Field label="Details" hint="Optional">
          {({ id, describedBy }) => <TextArea id={id} rows={3} describedBy={describedBy} maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* J11 Close out / end early                                                */
/* ------------------------------------------------------------------------ */

export function CloseOutDialog({ open, onOpenChange, detail, today, run, onDone, onCollect }: Common & { onCollect: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const due = balanceMinor(detail);
  const early = phaseForBooking(detail, today) === "ongoing";
  const day = tripDay(detail, today);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={early ? "End the trip early?" : "Close out this trip?"}
      description={
        early
          ? `It's day ${day?.day ?? 1} of ${day?.of ?? 1}. The trip ends today and moves to Completed.`
          : `Marks the trip completed and moves it out of wrap-up.`
      }
      footer={
        due > 0 ? (
          <>
            <button type="button" className={buttonClass()} onClick={() => onOpenChange(false)}>
              Not now
            </button>
            <button type="button" className={buttonClass({ variant: "primary" })} onClick={onCollect}>
              Record the payment
            </button>
          </>
        ) : (
          <>
            <button type="button" className={buttonClass()} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass({ variant: "primary" })}
              onClick={async () => {
                setBusy(true);
                const failed = await run({ type: "close_out" });
                setBusy(false);
                if (failed) setFailure(failed);
                else {
                  onOpenChange(false);
                  onDone(early ? "Trip ended" : "Trip closed — review requested");
                }
              }}
            >
              {early ? "End trip" : "Close out trip"}
            </button>
          </>
        )
      }
    >
      <FormError message={failure} />
      {due > 0 ? (
        <p className="dialog-summary warning">
          {formatMoney(due, detail.currency)} is still due. Record the payment first — a trip is only closed once it&rsquo;s paid.
        </p>
      ) : (
        <ul className="dialog-list">
          <li>The booking moves to Completed{early ? " with today as its last day" : ""}.</li>
          {detail.reviewRequestedAt ? null : <li>{firstName(detail.leadName)} is asked for a review.</li>}
          {detail.isMarketplace ? <li>Your payout joins the next weekly payout.</li> : null}
        </ul>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* J13 Reply to review                                                      */
/* ------------------------------------------------------------------------ */

export function ReplyDialog({ open, onOpenChange, detail, run, onDone }: Omit<Common, "today">) {
  const formId = useId();
  const [reply, setReply] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const review = detail.review;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reply to the review"
      description="Your reply appears publicly under the review on the experience page."
      footer={<Footer formId={formId} label="Post reply" onCancel={() => onOpenChange(false)} />}
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-[14px]"
        onSubmit={async (event) => {
          event.preventDefault();
          const failed = await run({ type: "reply_review", reply: reply.trim() });
          if (failed) setFailure(failed);
          else {
            onOpenChange(false);
            onDone("Reply posted");
          }
        }}
      >
        <FormError message={failure} />
        {review ? (
          <blockquote className="review-quote">
            <p className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} aria-hidden className={index < review.rating ? "filled" : undefined} />
              ))}
            </p>
            {review.title ? <p className="review-title">{review.title}</p> : null}
            {review.body ? <p className="review-body">{review.body}</p> : null}
          </blockquote>
        ) : null}
        <Field label="Your reply" required>
          {({ id }) => <TextArea id={id} rows={4} maxLength={1000} value={reply} placeholder={`Thank you, ${firstName(detail.leadName)}! …`} onChange={(event) => setReply(event.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* J14 Invoice                                                              */
/* ------------------------------------------------------------------------ */

/** Tour operator services — SAC 998555, GST at 5% without input tax credit. */
const GST_BPS = 500;

export function InvoiceDialog({ open, onOpenChange, detail, today }: Omit<Common, "run" | "onDone">) {
  const taxable = Math.round((detail.totalMinor * 10000) / (10000 + GST_BPS));
  const gst = detail.totalMinor - taxable;
  const due = balanceMinor(detail);
  const number = `INV-${detail.reference.replace(/\D/g, "")}`;
  // A tax invoice has to add up to the paisa, so it shows paise.
  const money = (value: number) => formatMoney(value, detail.currency, 2);
  const now = new Date(`${today}T12:00:00+05:30`);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Invoice"
      description="Preview. It becomes a GST tax invoice once your business name, address and GSTIN are added in Settings."
      footer={
        <>
          <button type="button" className={buttonClass()} onClick={() => onOpenChange(false)}>
            Close
          </button>
          <button type="button" className={buttonClass({ variant: "primary" })} onClick={() => window.print()}>
            <Printer aria-hidden />
            Print or save PDF
          </button>
        </>
      }
    >
      <article className="invoice invoice-print" aria-label={`Invoice ${number}`}>
        <header className="invoice-head">
          <div>
            <p className="invoice-kicker">Invoice</p>
            <p className="invoice-number">{number}</p>
          </div>
          <dl className="invoice-meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDayFull(detail.createdAt)}</dd>
            </div>
            <div>
              <dt>Booking</dt>
              <dd>{detail.reference}</dd>
            </div>
          </dl>
        </header>
        <div className="invoice-parties">
          <div>
            <p className="invoice-label">From</p>
            <p className="invoice-strong">Your business</p>
            <p className="invoice-muted">Name, address and GSTIN not set — add them in Settings</p>
          </div>
          <div>
            <p className="invoice-label">Billed to</p>
            <p className="invoice-strong">{detail.leadName}</p>
            {detail.leadEmail ? <p className="invoice-muted">{detail.leadEmail}</p> : null}
            {detail.leadPhone ? <p className="invoice-muted">{detail.leadPhone}</p> : null}
          </div>
        </div>
        <table className="invoice-lines">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">SAC</th>
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="invoice-strong">{detail.experienceTitle}</span>
                <span className="invoice-muted block">
                  {detail.travelStart ? formatDayRange(detail.travelStart, detail.travelEnd, now) : ""} ·{" "}
                  {guestCount(detail)} guest{guestCount(detail) === 1 ? "" : "s"}
                </span>
              </td>
              <td>998555</td>
              <td className="num">{money(taxable)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>CGST 2.5%</td>
              <td className="num">{money(Math.floor(gst / 2))}</td>
            </tr>
            <tr>
              <td colSpan={2}>SGST 2.5%</td>
              <td className="num">{money(gst - Math.floor(gst / 2))}</td>
            </tr>
            <tr className="total">
              <td colSpan={2}>Total</td>
              <td className="num">{money(detail.totalMinor)}</td>
            </tr>
            <tr>
              <td colSpan={2}>Paid</td>
              <td className="num">{money(detail.paidMinor)}</td>
            </tr>
            {detail.refundedMinor > 0 ? (
              <tr>
                <td colSpan={2}>Refunded</td>
                <td className="num">−{money(detail.refundedMinor)}</td>
              </tr>
            ) : null}
            <tr className="total">
              <td colSpan={2}>{due > 0 ? "Balance due" : "Balance"}</td>
              <td className="num">{money(due)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="invoice-muted">
          Place of supply assumed to be your state (CGST + SGST). Guests from another state are billed IGST 5% once
          addresses are captured.{detail.balanceDueAt && due > 0 ? ` Balance due by ${formatDay(detail.balanceDueAt, now)}.` : ""}
        </p>
      </article>
    </Dialog>
  );
}
