"use client";

import { Controller } from "react-hook-form";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import {
  ChipSelect,
  Field,
  RadioGroup,
  Select,
  TextInput,
} from "@/components/ui/field";
import {
  ACTIVITY_OPTIONS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  REGION_OPTIONS,
} from "@/lib/experience-wizard/options";
import {
  basicInfoSchema,
  type BasicInfoValues,
} from "@/lib/experience-wizard/schema";

const FORM_ID = "step-basic-info";

/** Step 1 of 7. */
export function StepBasicInfo() {
  const { form, handleSubmit, errorSummary } = useStepForm<
    "basicInfo",
    BasicInfoValues
  >({
    sectionKey: "basicInfo",
    slug: "basic-info",
    schema: basicInfoSchema,
  });

  const { control, register, formState } = form;
  const errors = formState.errors;

  return (
    <StepShell
      slug="basic-info"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
    >
      <RadioGroup
        legend="Type of experience"
        required
        value={form.watch("kind")}
        onChange={(value) => form.setValue("kind", value)}
        options={[
          { value: "general", label: "General" },
          { value: "quick", label: "Quick" },
          { value: "super", label: "Super" },
        ]}
        error={errors.kind?.message}
      />

      {/*
        Not in the handoff file: the wizard has no field for the experience's
        name, yet the table's first column is "Experience name" and the drawer
        leads with it. Added here rather than leaving an unnamed record.
      */}
      <Field
        label="Experience name"
        required
        error={errors.title?.message}
        hint="Shown on the marketplace and on your own site."
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            placeholder="7 Day Immersive Experience in Meghalaya"
            {...register("title")}
          />
        )}
      </Field>

      <div className="grid gap-[20px] lg:grid-cols-2">
        <Controller
          control={control}
          name="regions"
          render={({ field }) => (
            <ChipSelect
              label="Region/State"
              required
              placeholder="Select States"
              options={REGION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.regions?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Duration (days)" required error={errors.durationDays?.message}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("durationDays")}
              >
                {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day} {day === 1 ? "day" : "days"}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Nights" required error={errors.durationNights?.message}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("durationNights")}
              >
                {Array.from({ length: 30 }, (_, index) => index).map((night) => (
                  <option key={night} value={night}>
                    {night} {night === 1 ? "night" : "nights"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Controller
          control={control}
          name="categories"
          render={({ field }) => (
            <ChipSelect
              label="Categories"
              required
              placeholder="Select Categories"
              options={CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.categories?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            <ChipSelect
              label="Languages Spoken"
              required
              placeholder="Select Language"
              options={LANGUAGE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.languages?.message}
            />
          )}
        />

        <Field
          label="Minimum Eligible Age"
          required
          error={errors.minAge?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              {...register("minAge")}
            >
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age} yrs
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Maximum Eligible Age"
          required
          error={errors.maxAge?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              {...register("maxAge")}
            >
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age} yrs
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Controller
        control={control}
        name="activityTags"
        render={({ field }) => (
          <ChipSelect
            label="Activity Tags"
            required
            placeholder="Select Activities"
            options={ACTIVITY_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.activityTags?.message}
          />
        )}
      />

      <RadioGroup
        legend="Food Included"
        required
        value={form.watch("foodIncluded")}
        onChange={(value) => form.setValue("foodIncluded", value)}
        options={[
          { value: "none", label: "None" },
          { value: "breakfast_dinner", label: "Breakfast & Dinner" },
          { value: "breakfast_lunch_dinner", label: "Breakfast, Lunch & Dinner" },
        ]}
        error={errors.foodIncluded?.message}
      />

      <RadioGroup
        legend="Food Preferences Available"
        required
        value={form.watch("foodPreference")}
        onChange={(value) => form.setValue("foodPreference", value)}
        options={[
          { value: "veg_only", label: "Veg Only" },
          { value: "non_veg_only", label: "Non-veg Only" },
          { value: "both", label: "Both" },
        ]}
        error={errors.foodPreference?.message}
      />
    </StepShell>
  );
}

const AGES = Array.from({ length: 99 }, (_, index) => index + 1);
