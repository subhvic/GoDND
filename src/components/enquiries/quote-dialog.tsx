"use client";

import { useId, useMemo, useState } from "react";

import { QuoteCard } from "@/components/enquiries/message-parts";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import type { ExperienceOption } from "@/lib/data/experiences";
import { dayKey } from "@/lib/enquiries/format";
import type { EnquiryQuote, EnquiryRow } from "@/lib/types";

/**
 * Send a priced quote into the thread.
 *
 * The total starts from the experience's base price × paying guests and
 * follows the group size until the operator types their own number — after
 * that it is theirs and stays put. The card on the right is exactly what the
 * traveller will see, so there is no guessing how "₹5,88,000 for 6" reads.
 */
export function QuoteDialog({
  open,
  onOpenChange,
  row,
  experiences,
  now,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: EnquiryRow;
  experiences: ExperienceOption[];
  now: Date;
  onSend: (quote: EnquiryQuote, message: string | null) => void;
}) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Send a quote to ${row.contactName.split(" ")[0]}`}
      description={
        row.status === "new" || row.status === "open"
          ? "It appears in the conversation as a card they can come back to. Sending moves the enquiry to Quoted."
          : "It appears in the conversation as a card they can come back to."
      }
      footer={
        <>
          <button type="button" className={buttonClass()} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="submit" form={formId} className={buttonClass({ variant: "primary" })}>
            Send quote
          </button>
        </>
      }
    >
      <QuoteForm
        formId={formId}
        row={row}
        experiences={experiences}
        now={now}
        onSubmit={(quote, message) => {
          onSend(quote, message);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

const count = (value: string) => Math.max(0, Number.parseInt(value, 10) || 0);

type Errors = Partial<Record<"experience" | "adults" | "total" | "validUntil" | "startDate", string>>;

function QuoteForm({
  formId,
  row,
  experiences,
  now,
  onSubmit,
}: {
  formId: string;
  row: EnquiryRow;
  experiences: ExperienceOption[];
  now: Date;
  onSubmit: (quote: EnquiryQuote, message: string | null) => void;
}) {
  const today = dayKey(now);
  const [experienceId, setExperienceId] = useState(
    row.experienceId && experiences.some((entry) => entry.id === row.experienceId)
      ? row.experienceId
      : (experiences[0]?.id ?? ""),
  );
  const [startDate, setStartDate] = useState(row.preferredStart && row.preferredStart >= today ? row.preferredStart : "");
  const [adults, setAdults] = useState(String(Math.max(row.adults, 1)));
  const [children, setChildren] = useState(String(row.children));
  const [infants, setInfants] = useState(String(row.infants));
  const [totalInput, setTotalInput] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(dayKey(new Date(now.getTime() + 3 * 86_400_000)));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Here's the quote for your group — happy to adjust anything.");
  const [errors, setErrors] = useState<Errors>({});

  const experience = experiences.find((entry) => entry.id === experienceId) ?? null;
  const payingGuests = count(adults) + count(children);

  // Infants travel free by convention, so they don't multiply the base price.
  const suggestedTotal =
    experience?.basePriceMinor && payingGuests > 0
      ? Math.round((experience.basePriceMinor * payingGuests) / 100)
      : null;
  const total = totalInput ?? (suggestedTotal ? String(suggestedTotal) : "");
  const totalRupees = Number.parseInt(total.replace(/[,\s]/g, ""), 10);

  const preview = useMemo<EnquiryQuote | null>(() => {
    if (!experience || !Number.isFinite(totalRupees) || totalRupees <= 0) return null;
    return {
      kind: "quote",
      experienceId: experience.id,
      experienceTitle: experience.title,
      startDate: startDate || null,
      adults: Math.max(count(adults), 1),
      children: count(children),
      infants: count(infants),
      totalMinor: totalRupees * 100,
      currency: experience.currency || "INR",
      validUntil: validUntil || null,
      note: note.trim() || null,
    };
  }, [experience, totalRupees, startDate, adults, children, infants, validUntil, note]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!experience) next.experience = "Pick the experience you're quoting";
    if (count(adults) < 1) next.adults = "At least one adult";
    if (!Number.isFinite(totalRupees) || totalRupees <= 0) next.total = "Enter the total in rupees";
    if (validUntil && validUntil < today) next.validUntil = "Pick a date from today on";
    if (startDate && startDate < today) next.startDate = "That date has passed";
    setErrors(next);
    if (Object.keys(next).length > 0 || !preview) return;
    onSubmit(preview, message.trim() || null);
  };

  return (
    <form id={formId} className="quote-form" onSubmit={submit} noValidate>
      <div className="quote-form-fields">
        <Field label="Experience" required error={errors.experience}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} describedBy={describedBy} invalid={invalid} value={experienceId} onChange={(event) => setExperienceId(event.target.value)}>
              {experiences.length === 0 ? <option value="">No active experiences</option> : null}
              {experiences.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="form-grid-2">
          <Field label="Start date" error={errors.startDate}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="date" min={today} describedBy={describedBy} invalid={invalid} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            )}
          </Field>
          <Field label="Valid until" error={errors.validUntil} hint="Dates are held until then">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="date" min={today} describedBy={describedBy} invalid={invalid} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            )}
          </Field>
        </div>

        <div className="form-grid-3">
          <Field label="Adults" required error={errors.adults}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={1} max={99} describedBy={describedBy} invalid={invalid} value={adults} onChange={(event) => setAdults(event.target.value)} />
            )}
          </Field>
          <Field label="Children">
            {({ id }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={0} max={99} value={children} onChange={(event) => setChildren(event.target.value)} />
            )}
          </Field>
          <Field label="Infants">
            {({ id }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={0} max={99} value={infants} onChange={(event) => setInfants(event.target.value)} />
            )}
          </Field>
        </div>

        <Field
          label="Total for the group"
          required
          error={errors.total}
          hint={
            totalInput === null && suggestedTotal
              ? `Base price × ${payingGuests} paying guest${payingGuests === 1 ? "" : "s"}. Type to override.`
              : "Including taxes, in whole rupees"
          }
        >
          {({ id, describedBy, invalid }) => (
            <div className="flex items-center gap-[8px]">
              <AffixInput
                id={id}
                prefix="₹"
                inputMode="numeric"
                describedBy={describedBy}
                invalid={invalid}
                value={total}
                onChange={(event) => setTotalInput(event.target.value.replace(/[^\d]/g, ""))}
                className="flex-1"
              />
              {totalInput !== null && suggestedTotal ? (
                <button type="button" className={buttonClass({ size: "small" })} onClick={() => setTotalInput(null)}>
                  Use base price
                </button>
              ) : null}
            </div>
          )}
        </Field>

        <Field label="What's included" hint="Shown on the quote card">
          {({ id, describedBy }) => (
            <TextInput id={id} describedBy={describedBy} maxLength={500} placeholder="e.g. Airport transfers, all meals, river gear" value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>

        <Field label="Message with the quote">
          {({ id }) => (
            <TextArea id={id} rows={2} className="min-h-[60px]" value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} />
          )}
        </Field>
      </div>

      <div className="quote-form-preview" aria-live="polite">
        <p className="details-label">What {row.contactName.split(" ")[0]} sees</p>
        {preview ? (
          <QuoteCard quote={preview} now={now} />
        ) : (
          <div className="quote-card quote-placeholder">
            <p>Pick an experience and enter a total to preview the quote.</p>
          </div>
        )}
      </div>
    </form>
  );
}
