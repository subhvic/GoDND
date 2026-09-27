"use client";

import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { DocumentListField } from "@/components/settings/document-field";
import { ReviewBanner, SectionFrame } from "@/components/settings/section-frame";
import {
  EditAction,
  ErrorSummary,
  ReviewedFooter,
  useReviewedSection,
} from "@/components/settings/use-reviewed-section";
import { ChipSelect, Field, FieldError, Label, TextArea } from "@/components/ui/field";
import {
  ACTIVITY_OPTIONS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  REGION_OPTIONS,
} from "@/lib/experience-wizard/options";
import type { OperationsValues } from "@/lib/settings/model";
import { MISSION_MAX, MISSION_MIN, operationsSchema } from "@/lib/settings/schema";

/**
 * Settings › Operational Details (step 5 of 7) — the frame the handoff link
 * points at. Its option lists are the experience wizard's, so "Meghalaya"
 * here and "Meghalaya" on an experience are one tag, not two spellings.
 */
export function SectionOperations() {
  const api = useReviewedSection({
    sectionKey: "operations",
    slug: "operations",
    schema: operationsSchema,
    toForm: (values: OperationsValues) => values,
    fromForm: (values: OperationsValues) => values,
  });
  const { form, locked } = api;
  const { register, control } = form;
  const errors = form.formState.errors;
  const mission = useWatch({ control, name: "mission" }) ?? "";
  const nameId = useId();
  const count = mission.trim().length;

  return (
    <SectionFrame
      slug="operations"
      action={<EditAction api={api} />}
      banner={<ReviewBanner slug="operations" record={api.record} editing={api.editing} />}
      footer={<ReviewedFooter slug="operations" api={api} />}
    >
      <ErrorSummary message={api.errorSummary} />
      <form id={api.formId} onSubmit={api.submit} noValidate className="settings-form">
        <fieldset disabled={locked}>
          <div className="field">
            <Label htmlFor={nameId} required>
              Company name
            </Label>
            <input
              id={nameId}
              className="title-input"
              placeholder="Your company name"
              autoComplete="organization"
              aria-invalid={Boolean(errors.brandName) || undefined}
              aria-describedby={`${nameId}-hint${errors.brandName ? ` ${nameId}-error` : ""}`}
              {...register("brandName")}
            />
            <p id={`${nameId}-hint`} className="field-hint">
              The name travellers see on your listings.
            </p>
            <FieldError id={`${nameId}-error`} message={errors.brandName?.message} />
          </div>

          <Field
            label="Brief on your company mission"
            required
            error={errors.mission?.message}
            hint={`${count} / ${MISSION_MAX} characters${count > 0 && count < MISSION_MIN ? ` — at least ${MISSION_MIN}` : ""}`}
          >
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                rows={4}
                maxLength={MISSION_MAX}
                placeholder="What you stand for, in a sentence or two. It opens your profile on the marketplace."
                {...register("mission")}
              />
            )}
          </Field>

          <div className="settings-grid">
            <Controller
              control={control}
              name="regions"
              render={({ field }) => (
                <ChipSelect
                  label="Areas of Operation"
                  required
                  placeholder="Select States"
                  options={REGION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.regions?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="categories"
              render={({ field }) => (
                <ChipSelect
                  label="Experience Categories"
                  required
                  placeholder="Select Category"
                  options={CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.categories?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="activities"
              render={({ field }) => (
                <ChipSelect
                  label="Top Activities"
                  required
                  placeholder="Select Activity"
                  options={ACTIVITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.activities?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="languages"
              render={({ field }) => (
                <ChipSelect
                  label="Languages Supported"
                  required
                  placeholder="Select Language"
                  options={LANGUAGE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.languages?.message}
                />
              )}
            />
          </div>

          <Controller
            control={control}
            name="otherDocuments"
            render={({ field }) => (
              <DocumentListField
                label="Any other relevant certifications"
                folder="operations"
                max={5}
                value={field.value}
                onChange={field.onChange}
                error={errors.otherDocuments?.message}
                hint="Optional — awards, safety audits, eco-certifications."
                disabled={locked}
              />
            )}
          />
        </fieldset>
      </form>
    </SectionFrame>
  );
}
