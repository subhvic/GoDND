"use client";

import { Controller } from "react-hook-form";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { Checkbox, ChipSelect, Field, TextArea } from "@/components/ui/field";
import {
  ACCESSIBILITY_OPTIONS,
  ADDITIONAL_INFO_OPTIONS,
  EXCLUSION_OPTIONS,
  INCLUSION_OPTIONS,
} from "@/lib/experience-wizard/options";
import {
  policiesSchema,
  type PoliciesValues,
} from "@/lib/experience-wizard/schema";

const FORM_ID = "step-policies";

/** Step 6 of 7 — Support & Policies. */
export function StepPolicies() {
  const { form, handleSubmit, errorSummary } = useStepForm<
    "policies",
    PoliciesValues
  >({
    sectionKey: "policies",
    slug: "policies",
    schema: policiesSchema,
  });

  const { control, register, watch, setValue, formState } = form;
  const errors = formState.errors;

  const accessibility = watch("accessibility") ?? [];
  const additionalInfo = watch("additionalInfo") ?? [];

  const toggle = (
    field: "accessibility" | "additionalInfo",
    value: string,
    checked: boolean,
  ) => {
    const current = field === "accessibility" ? accessibility : additionalInfo;
    setValue(
      field,
      checked ? [...current, value] : current.filter((item) => item !== value),
      { shouldDirty: true },
    );
  };

  return (
    <StepShell
      slug="policies"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
    >
      <section aria-labelledby="inclusions">
        <h3 id="inclusions" className="text-body font-medium text-neutral-1">
          Things Included and Not Included in the experience
        </h3>
        <p className="mt-[4px] text-small text-neutral-2">
          {Math.max(
            14 - watch("inclusions").length - watch("exclusions").length,
            0,
          )}{" "}
          confirmations left
        </p>

        <div className="mt-[16px] grid gap-[20px] lg:grid-cols-2">
          <Controller
            control={control}
            name="inclusions"
            render={({ field }) => (
              <ChipSelect
                label="What's Included?"
                required
                options={INCLUSION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.inclusions?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="exclusions"
            render={({ field }) => (
              <ChipSelect
                label="What's Not Included?"
                required
                options={EXCLUSION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.exclusions?.message}
              />
            )}
          />
        </div>
      </section>

      <section aria-labelledby="departure">
        <h3 id="departure" className="mb-[12px] text-body font-medium text-neutral-1">
          Departure and Return
        </h3>
        <Field
          label="Write something about the first point of contact"
          required
          error={errors.departureNote?.message}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              placeholder="Type here…"
              {...register("departureNote")}
            />
          )}
        </Field>
      </section>

      <CheckboxSection
        id="accessibility"
        title="Accessibility"
        options={ACCESSIBILITY_OPTIONS}
        selected={accessibility}
        onToggle={(value, checked) => toggle("accessibility", value, checked)}
      />

      <CheckboxSection
        id="additional-info"
        title="Additional Information"
        options={ADDITIONAL_INFO_OPTIONS}
        selected={additionalInfo}
        onToggle={(value, checked) => toggle("additionalInfo", value, checked)}
      />

      <section aria-labelledby="cancellation">
        <h3
          id="cancellation"
          className="mb-[12px] text-body font-medium text-neutral-1"
        >
          Cancellation Policy
        </h3>
        <Checkbox
          checked={watch("acceptCancellationPolicy") === true}
          onChange={(checked) =>
            setValue(
              "acceptCancellationPolicy",
              checked as unknown as true,
              { shouldValidate: formState.isSubmitted },
            )
          }
          label={
            <>
              We abide by the{" "}
              <a
                href="/legal/cancellation-policy"
                className="text-brand underline underline-offset-2"
              >
                General Cancellation Policy of GoDND
              </a>{" "}
              and agree to imply the same on this experience&rsquo;s booking.
            </>
          }
        />
        {errors.acceptCancellationPolicy ? (
          <p role="alert" className="mt-[6px] text-small text-[#d92d20]">
            {errors.acceptCancellationPolicy.message}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="help-policy">
        <h3 id="help-policy" className="mb-[12px] text-body font-medium text-neutral-1">
          Help &amp; Policy
        </h3>
        <Checkbox
          checked={watch("acceptSupportStandards") === true}
          onChange={(checked) =>
            setValue("acceptSupportStandards", checked as unknown as true, {
              shouldValidate: formState.isSubmitted,
            })
          }
          label={
            <>
              We abide by the{" "}
              <a
                href="/legal/support-standards"
                className="text-brand underline underline-offset-2"
              >
                Customer Support Standards of GoDND
              </a>{" "}
              and agree to follow the same on this experience&rsquo;s booking.
            </>
          }
        />
        {errors.acceptSupportStandards ? (
          <p role="alert" className="mt-[6px] text-small text-[#d92d20]">
            {errors.acceptSupportStandards.message}
          </p>
        ) : null}
      </section>
    </StepShell>
  );
}

/**
 * A two-column checkbox block. Rendered as a fieldset so the group has one
 * accessible name rather than a dozen unrelated checkboxes.
 */
function CheckboxSection({
  id,
  title,
  options,
  selected,
  onToggle,
}: {
  id: string;
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}) {
  return (
    <fieldset aria-labelledby={`${id}-legend`}>
      <legend
        id={`${id}-legend`}
        className="mb-[12px] text-body font-medium text-neutral-1"
      >
        {title}
      </legend>
      <div className="grid gap-x-[24px] gap-y-[12px] lg:grid-cols-2">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            onChange={(checked) => onToggle(option.value, checked)}
          />
        ))}
      </div>
    </fieldset>
  );
}
