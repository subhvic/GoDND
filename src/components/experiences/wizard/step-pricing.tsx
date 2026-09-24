"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { AffixInput, Field, RadioGroup, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
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
      <h3 className="form-section-title">Set a base price</h3>

      <Field
        label="Base price"
        required
        error={errors.basePrice?.message}
        className="max-w-[320px]"
      >
        {({ id, describedBy, invalid }) => (
          <AffixInput
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            prefix="₹"
            suffix="per guest"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            {...register("basePrice")}
          />
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

      <p className="field-hint">
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
                  <AffixInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    prefix="₹"
                    suffix="total"
                    type="number"
                    min={0}
                    step={100}
                    inputMode="numeric"
                    {...register(`tiers.${key}` as const)}
                  />
                )}
              </Field>
            );
          })}
        </div>
      ) : (
        <Notice status="info" title={`${formatMoney(basePrice * 100)} per guest`}>
          A group of {maxGuests} pays {formatMoney(basePrice * maxGuests * 100)} before tax.
        </Notice>
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
      <h3 className="form-section-title">
        Price Preview for Your Guests
      </h3>
      <p className="m-0 mt-[2px] text-[11px] text-text-muted">What a guest pays, including taxes</p>

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

      <p className="m-0 mt-[18px] text-[12px] text-text-muted line-through">
        {formatMoney(strikethrough * 100)}
      </p>
      <p className="m-0 mt-[4px] text-[30px] font-semibold leading-none text-text-primary">
        {formatMoney(payable * 100)}
      </p>
      {guests > 1 ? (
        <p className="field-hint m-0 mt-[6px]">
          {formatMoney((payable / guests) * 100)} per person
        </p>
      ) : null}

      <details open className="mt-[16px] border-t border-border-subtle pt-[12px]">
        <summary className="cursor-pointer text-[10.5px] font-semibold uppercase tracking-[.5px] text-text-muted">
          See breakup
        </summary>
        <dl className="mt-[12px] space-y-[10px]">
          <Line label="Experiences Base Fare" value={formatMoney(fare * 100)} />
          <Line label="Taxes (GST)" value={formatMoney(tax * 100)} />
          <Line
            label={
              <span className="flex flex-col">
                Coupon Discount
                <span className="mt-[4px] flex items-center gap-[6px] field-hint">
                  {SAMPLE_COUPON.percentOff}% Off
                  <span className="token-chip">
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
      <dt className="text-[12px] text-text-secondary">{label}</dt>
      <dd className="m-0 shrink-0 text-[12px] font-medium text-text-primary">{value}</dd>
    </div>
  );
}
