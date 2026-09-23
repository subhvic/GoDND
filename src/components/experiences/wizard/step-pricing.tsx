"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { Field, RadioGroup, Select, TextInput } from "@/components/ui/field";
import {
  pricingSchema,
  type PricingValues,
} from "@/lib/experience-wizard/schema";
import { formatMoney } from "@/lib/utils";

const FORM_ID = "step-pricing";

/** GST on tour packages. Mirrors experiences.gst_rate_bps in the schema. */
const GST_BPS = 500;
const SAMPLE_COUPON = { code: "MYFIRSTDND", percentOff: 20 };

/**
 * Step 4 of 7 — Pricing Strategy.
 *
 * "Set variable Pricing" stores a TOTAL per guest count, confirmed with the
 * product owner: "2 Guests — ₹13,500" is the pair's total, not a per-head
 * rate. The preview panel therefore divides to show a per-person figure too,
 * because a traveller comparing against per-head competitor quotes will
 * otherwise read ₹13,500 as one person's price.
 */
export function StepPricing() {
  const { form, handleSubmit, errorSummary } = useStepForm<"pricing", PricingValues>({
    sectionKey: "pricing",
    slug: "pricing",
    schema: pricingSchema,
  });

  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;

  const basePrice = Number(watch("basePrice")) || 0;
  const maxGuests = Number(watch("maxGuestsPerBooking")) || 1;
  const mode = watch("pricingMode");
  const tiers = watch("tiers") ?? {};

  const [previewGuests, setPreviewGuests] = useState(maxGuests);
  const guests = Math.min(previewGuests, maxGuests);

  const fare = totalFor({ mode, basePrice, tiers, guests });
  const tax = Math.round((fare * GST_BPS) / 10000);
  const discount = Math.round((fare * SAMPLE_COUPON.percentOff) / 100);
  const payable = fare + tax - discount;

  return (
    <StepShell
      slug="pricing"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
      aside={
        <PricePreview
          guests={guests}
          maxGuests={maxGuests}
          onGuestsChange={setPreviewGuests}
          fare={fare}
          tax={tax}
          discount={discount}
          payable={payable}
          strikethrough={fare + tax}
        />
      }
    >
      <h3 className="text-body font-medium text-neutral-1">Set a Base Price</h3>

      <Field label="Base price" required error={errors.basePrice?.message}>
        {({ id, describedBy, invalid }) => (
          <div className="flex items-baseline gap-[10px]">
            <span aria-hidden className="text-display-sm font-medium text-neutral-1">
              ₹
            </span>
            <TextInput
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              className="max-w-[180px] border-0 border-b border-neutral-4 px-0 text-display-sm font-medium"
              {...register("basePrice")}
            />
            <span className="text-small text-neutral-2">per guest</span>
          </div>
        )}
      </Field>

      <Field
        label="Max no. of guests allowed in one booking"
        required
        error={errors.maxGuestsPerBooking?.message}
        className="max-w-[320px]"
      >
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            {...register("maxGuestsPerBooking")}
          >
            {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <p className="text-small text-neutral-2">
        Please set individual pricing for each number of guests.
      </p>

      <RadioGroup
        legend="Pricing mode"
        value={mode}
        onChange={(value) => setValue("pricingMode", value)}
        options={[
          { value: "unit_multiply", label: "Unit multiply with Guests" },
          { value: "variable", label: "Set variable Pricing" },
        ]}
      />

      {mode === "variable" ? (
        <div className="grid gap-[16px] sm:grid-cols-2">
          {Array.from({ length: Math.max(maxGuests - 1, 0) }, (_, index) => {
            const count = index + 2;
            const key = String(count);
            const tierError = (
              errors.tiers as Record<string, { message?: string }> | undefined
            )?.[key]?.message;

            return (
              <Field
                key={key}
                label={`${count} Guests`}
                required
                error={tierError}
                hint={
                  tiers[key]
                    ? `${formatMoney(Number(tiers[key]) * 100)} total · ${formatMoney(
                        (Number(tiers[key]) / count) * 100,
                      )} per person`
                    : undefined
                }
              >
                {({ id, describedBy, invalid }) => (
                  <div className="flex items-center gap-[8px]">
                    <span aria-hidden className="text-small text-neutral-2">
                      ₹
                    </span>
                    <TextInput
                      id={id}
                      describedBy={describedBy}
                      invalid={invalid}
                      type="number"
                      min={0}
                      step={100}
                      inputMode="numeric"
                      {...register(`tiers.${key}` as const)}
                    />
                  </div>
                )}
              </Field>
            );
          })}
        </div>
      ) : (
        <p className="border border-line-soft bg-surface-sunken px-[12px] py-[10px] text-small text-ink-muted">
          Guests pay {formatMoney(basePrice * 100)} each. A group of {maxGuests}{" "}
          pays {formatMoney(basePrice * maxGuests * 100)} before tax.
        </p>
      )}
    </StepShell>
  );
}

function totalFor({
  mode,
  basePrice,
  tiers,
  guests,
}: {
  mode: PricingValues["pricingMode"];
  basePrice: number;
  tiers: Record<string, number>;
  guests: number;
}) {
  if (mode === "unit_multiply") return Math.round(basePrice * guests);
  const tier = Number(tiers[String(guests)]);
  // Falls back to the base price so the preview shows something sensible while
  // the operator is still filling the tiers in.
  return Number.isFinite(tier) && tier > 0 ? tier : Math.round(basePrice * guests);
}

/** The "Price Preview for Your Guests" panel from the handoff file. */
function PricePreview({
  guests,
  maxGuests,
  onGuestsChange,
  fare,
  tax,
  discount,
  payable,
  strikethrough,
}: {
  guests: number;
  maxGuests: number;
  onGuestsChange: (guests: number) => void;
  fare: number;
  tax: number;
  discount: number;
  payable: number;
  strikethrough: number;
}) {
  return (
    <div>
      <h3 className="text-body font-medium text-neutral-1">
        Price Preview for Your Guests
      </h3>
      <p className="mt-[2px] text-small text-brand">Including fees and taxes</p>

      <Field label="Select No. of Guests" required className="mt-[16px]">
        {({ id }) => (
          <Select
            id={id}
            value={guests}
            onChange={(event) => onGuestsChange(Number(event.target.value))}
          >
            {Array.from({ length: maxGuests }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ),
            )}
          </Select>
        )}
      </Field>

      <p className="mt-[20px] text-body text-neutral-2 line-through">
        {formatMoney(strikethrough * 100)}
      </p>
      <p className="text-display-sm font-medium text-neutral-1">
        {formatMoney(payable * 100)}
      </p>
      {guests > 1 ? (
        <p className="mt-[2px] text-small text-neutral-2">
          {formatMoney((payable / guests) * 100)} per person
        </p>
      ) : null}

      <details open className="mt-[16px]">
        <summary className="cursor-pointer text-small font-medium text-neutral-1">
          See breakup
        </summary>
        <dl className="mt-[12px] space-y-[10px]">
          <Line label="Experiences Base Fare" value={formatMoney(fare * 100)} />
          <Line label="Taxes (GST)" value={formatMoney(tax * 100)} />
          <Line
            label={
              <span className="flex flex-col">
                Coupon Discount
                <span className="mt-[4px] flex items-center gap-[6px] text-small text-neutral-2">
                  {SAMPLE_COUPON.percentOff}% Off
                  <span className="bg-[#7C3AED] px-[6px] py-[2px] text-[11px] font-medium text-white">
                    {SAMPLE_COUPON.code}
                  </span>
                  <Info aria-hidden className="size-[12px]" />
                </span>
              </span>
            }
            value={`- ${formatMoney(discount * 100)}`}
          />
        </dl>
      </details>
    </div>
  );
}

function Line({
  label,
  value,
}: {
  label: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-[16px]">
      <dt className="text-small text-neutral-1">{label}</dt>
      <dd className="shrink-0 text-small font-medium text-neutral-1">{value}</dd>
    </div>
  );
}
