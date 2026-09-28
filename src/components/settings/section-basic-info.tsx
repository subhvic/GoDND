"use client";

import { Controller } from "react-hook-form";

import { DocumentField } from "@/components/settings/document-field";
import { ReviewBanner, SectionFrame } from "@/components/settings/section-frame";
import {
  EditAction,
  ErrorSummary,
  ReviewedFooter,
  useReviewedSection,
} from "@/components/settings/use-reviewed-section";
import { Field, Select, TextInput } from "@/components/ui/field";
import type { BasicInfoValues } from "@/lib/settings/model";
import { BUSINESS_TYPES, INDIA_STATES } from "@/lib/settings/options";
import { basicInfoSchema } from "@/lib/settings/schema";

/** Settings › Basic Info (step 1 of 7). */
export function SectionBasicInfo() {
  const api = useReviewedSection({
    sectionKey: "basicInfo",
    slug: "basic-info",
    schema: basicInfoSchema,
    toForm: (values: BasicInfoValues) => values,
    fromForm: (values: BasicInfoValues) => values,
  });
  const { form, locked } = api;
  const { register, control } = form;
  const errors = form.formState.errors;

  return (
    <SectionFrame
      slug="basic-info"
      action={<EditAction api={api} />}
      banner={<ReviewBanner slug="basic-info" record={api.record} editing={api.editing} />}
      footer={<ReviewedFooter slug="basic-info" api={api} />}
    >
      <ErrorSummary message={api.errorSummary} />
      <form id={api.formId} onSubmit={api.submit} noValidate className="settings-form">
        <fieldset disabled={locked}>
          <Controller
            control={control}
            name="logo"
            render={({ field }) => (
              <DocumentField
                label="Company logo"
                required
                image
                folder="basic-info"
                value={field.value}
                onChange={field.onChange}
                error={errors.logo?.message}
                hint="Square works best; it’s shown small beside your name."
                disabled={locked}
              />
            )}
          />

          <div className="settings-grid">
            <Field
              label="Legal name of the business"
              required
              error={errors.legalName?.message}
              hint="Exactly as on your PAN — GoDND matches the two."
              className="span-2"
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  autoComplete="organization"
                  placeholder="Wander Beyond Travels LLP"
                  {...register("legalName")}
                />
              )}
            </Field>

            <Field label="Form of business" required error={errors.businessType?.message}>
              {({ id, describedBy, invalid }) => (
                <Select id={id} describedBy={describedBy} invalid={invalid} {...register("businessType")}>
                  <option value="">Select</option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Year established" required error={errors.establishedYear?.message}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2019"
                  {...register("establishedYear")}
                />
              )}
            </Field>
          </div>

          <fieldset className="settings-group">
            <legend className="settings-group-title">Registered address</legend>
            <div className="settings-grid">
              <Field label="Address" required error={errors.addressLine1?.message} className="span-2">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    autoComplete="address-line1"
                    placeholder="Building, street"
                    {...register("addressLine1")}
                  />
                )}
              </Field>
              <Field label="Address line 2" error={errors.addressLine2?.message} className="span-2">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    autoComplete="address-line2"
                    placeholder="Area, landmark (optional)"
                    {...register("addressLine2")}
                  />
                )}
              </Field>
              <Field label="City" required error={errors.city?.message}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    autoComplete="address-level2"
                    {...register("city")}
                  />
                )}
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-[12px]">
                <Field label="State" required error={errors.state?.message}>
                  {({ id, describedBy, invalid }) => (
                    <Select id={id} describedBy={describedBy} invalid={invalid} {...register("state")}>
                      <option value="">Select</option>
                      {INDIA_STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="PIN code" required error={errors.pincode?.message}>
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      describedBy={describedBy}
                      invalid={invalid}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      {...register("pincode")}
                    />
                  )}
                </Field>
              </div>
            </div>
          </fieldset>

          <fieldset className="settings-group">
            <legend className="settings-group-title">How GoDND reaches you</legend>
            <div className="settings-grid">
              <Field label="Business email" required error={errors.email?.message}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    type="email"
                    autoComplete="email"
                    placeholder="hello@yourcompany.in"
                    {...register("email")}
                  />
                )}
              </Field>
              <Field label="Business phone" required error={errors.phone?.message}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98620 33145"
                    {...register("phone")}
                  />
                )}
              </Field>
              <Field label="Website" error={errors.website?.message} className="span-2">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="wanderbeyond.in (optional)"
                    {...register("website")}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        </fieldset>
      </form>
    </SectionFrame>
  );
}
