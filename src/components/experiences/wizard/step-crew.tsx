"use client";

import { Controller } from "react-hook-form";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { Checkbox, ChipSelect, Field, Select } from "@/components/ui/field";
import { CREW_OPTIONS } from "@/lib/experience-wizard/options";
import { crewSchema, type CrewValues } from "@/lib/experience-wizard/schema";

const FORM_ID = "step-crew";

/** Step 3 of 7 — Crew & Trip Capacity. */
export function StepCrew() {
  const { form, handleSubmit, errorSummary } = useStepForm<"crew", CrewValues>({
    sectionKey: "crew",
    slug: "crew",
    schema: crewSchema,
  });

  const { control, register, watch, setValue, formState } = form;
  const errors = formState.errors;
  const hasGroundCrew = watch("hasGroundCrew");

  return (
    <StepShell
      slug="crew"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
    >
      <section aria-labelledby="crew-info">
        <h3 id="crew-info" className="mb-[14px] form-section-title">
          Crew Info
        </h3>

        <div className="grid gap-[20px] lg:grid-cols-2">
          <Field label="Trip Captain" required error={errors.tripCaptain?.message}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("tripCaptain")}
              >
                <option value="">Select a crew member</option>
                {CREW_OPTIONS.map((person) => (
                  <option key={person.value} value={person.value}>
                    {person.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Trip Co-ordinator"
            required
            error={errors.coordinator?.message}
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("coordinator")}
              >
                <option value="">Select a crew member</option>
                {CREW_OPTIONS.map((person) => (
                  <option key={person.value} value={person.value}>
                    {person.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Checkbox
          className="mt-[18px]"
          label="More people are involved in the ground"
          checked={hasGroundCrew}
          onChange={(checked) => {
            setValue("hasGroundCrew", checked);
            // Clearing on un-check keeps the saved draft honest: a hidden list
            // that still carries names would quietly reappear later.
            if (!checked) setValue("crewMembers", []);
          }}
        />

        {hasGroundCrew ? (
          <Controller
            control={control}
            name="crewMembers"
            render={({ field }) => (
              <ChipSelect
                className="mt-[16px]"
                label="Add Members"
                required
                placeholder="Type member name"
                options={CREW_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.crewMembers?.message}
              />
            )}
          />
        ) : null}
      </section>

      <section aria-labelledby="trip-capacity" className="mt-[10px]">
        <h3
          id="trip-capacity"
          className="mb-[14px] form-section-title"
        >
          Trip Capacity
        </h3>

        <div className="grid gap-[20px] lg:grid-cols-2">
          <Field
            label="Onboarding Strategy"
            required
            error={errors.onboardingStrategy?.message}
            hint={ONBOARDING_HINTS[watch("onboardingStrategy")]}
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("onboardingStrategy")}
              >
                <option value="open">Open to All</option>
                <option value="invite_only">Invite Only</option>
                <option value="request_to_join">Request to Join</option>
              </Select>
            )}
          </Field>

          <Field
            label="Maximum Group Size"
            required
            error={errors.maxGroupSize?.message}
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("maxGroupSize")}
              >
                {Array.from({ length: 30 }, (_, index) => index + 1).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </section>
    </StepShell>
  );
}

/**
 * The file offers "Invite Only" with no explanation of what it does. These
 * hints are mine — an operator picking a strategy that changes who can book
 * deserves to know what they are choosing.
 */
const ONBOARDING_HINTS: Record<CrewValues["onboardingStrategy"], string> = {
  open: "Anyone can book this experience directly.",
  invite_only:
    "Hidden from public listings. Only travellers you send an invite link to can book.",
  request_to_join:
    "Travellers apply, and you approve each one before payment is taken.",
};
