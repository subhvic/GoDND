"use client";

import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";

import { DocumentField } from "@/components/settings/document-field";
import { ReviewBanner, SectionFrame } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import {
  EditAction,
  ErrorSummary,
  ReviewedFooter,
  useReviewedSection,
} from "@/components/settings/use-reviewed-section";
import { Checkbox, Field, FieldError, RadioGroup, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { ComplianceValues } from "@/lib/settings/model";
import {
  PAN_HOLDER_LABELS,
  REGISTRATION_LABELS,
  businessTypeInfo,
  stateForGstCode,
} from "@/lib/settings/options";
import { PAN_PATTERN, cleanId, complianceSchema } from "@/lib/settings/schema";

/** Settings › Compliance (step 2 of 7). */
export function SectionCompliance() {
  const { state, navigate } = useSettings();
  const businessType = state.basicInfo.values.businessType;
  const type = businessTypeInfo(businessType);
  const registration = REGISTRATION_LABELS[type?.registration ?? "udyam"];
  const schema = useMemo(() => complianceSchema(businessType), [businessType]);

  const api = useReviewedSection({
    sectionKey: "compliance",
    slug: "compliance",
    schema,
    toForm: (values: ComplianceValues) => values,
    fromForm: (values: ComplianceValues) => values,
  });
  const { form, locked } = api;
  const { register, control } = form;
  const errors = form.formState.errors;
  const [pan, gstin, gstRegistered] = useWatch({ control, name: ["pan", "gstin", "gstRegistered"] });

  const panClean = cleanId(pan ?? "");
  const panHint =
    PAN_PATTERN.test(panClean) && PAN_HOLDER_LABELS[panClean[3]]
      ? `Issued to ${PAN_HOLDER_LABELS[panClean[3]]}.`
      : type?.panHolder
        ? `The business’s own PAN — its 4th letter is ${type.panHolder} for ${type.label.toLowerCase()}.`
        : "The business’s own PAN, not a partner’s or director’s.";
  const gstState = stateForGstCode(cleanId(gstin ?? "").slice(0, 2));

  return (
    <SectionFrame
      slug="compliance"
      action={<EditAction api={api} />}
      banner={
        <ReviewBanner
          slug="compliance"
          record={api.record}
          editing={api.editing}
          editConsequence="GoDND re-checks PAN and GST before the change takes effect. Your live experiences stay live meanwhile."
        />
      }
      footer={<ReviewedFooter slug="compliance" api={api} />}
    >
      <ErrorSummary message={api.errorSummary} />
      <form id={api.formId} onSubmit={api.submit} noValidate className="settings-form">
        <fieldset disabled={locked}>
          <fieldset className="settings-group">
            <legend className="settings-group-title">PAN</legend>
            <div className="settings-grid">
              <Field label="PAN of the business" required error={errors.pan?.message} hint={panHint}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    className="uppercase"
                    maxLength={10}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="AAHFW4821K"
                    {...register("pan")}
                  />
                )}
              </Field>
              <Controller
                control={control}
                name="panDocument"
                render={({ field }) => (
                  <DocumentField
                    label="Copy of the PAN card"
                    required
                    folder="compliance"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.panDocument?.message}
                    disabled={locked}
                  />
                )}
              />
            </div>
          </fieldset>

          <fieldset className="settings-group">
            <legend className="settings-group-title">GST</legend>
            <RadioGroup
              legend="Are you registered for GST?"
              required
              value={gstRegistered}
              onChange={(value) => form.setValue("gstRegistered", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              error={errors.gstRegistered?.message}
            />
            {gstRegistered === "yes" ? (
              <div className="settings-grid">
                <Field
                  label="GSTIN"
                  required
                  error={errors.gstin?.message}
                  hint={gstState ? `Registered in ${gstState.label}.` : "15 characters, starting with your state’s code."}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      describedBy={describedBy}
                      invalid={invalid}
                      className="uppercase"
                      maxLength={15}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="17AAHFW4821K1ZU"
                      {...register("gstin")}
                    />
                  )}
                </Field>
                <Controller
                  control={control}
                  name="gstDocument"
                  render={({ field }) => (
                    <DocumentField
                      label="GST registration certificate"
                      required
                      folder="compliance"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.gstDocument?.message}
                      disabled={locked}
                    />
                  )}
                />
              </div>
            ) : gstRegistered === "no" ? (
              <p className="settings-note">
                GST registration is needed once turnover crosses ₹20 lakh a year (₹10 lakh in Manipur, Mizoram,
                Nagaland and Tripura). Add your GSTIN here when you register.
              </p>
            ) : null}
          </fieldset>

          <fieldset className="settings-group">
            <legend className="settings-group-title">Registration</legend>
            {type ? (
              <div className="settings-grid">
                <Field
                  label={registration.label}
                  required={registration.required}
                  error={errors.registrationNumber?.message}
                  hint={registration.required ? undefined : "Optional — add it if you’re registered as an MSME."}
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      describedBy={describedBy}
                      invalid={invalid}
                      className="uppercase"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={registration.placeholder}
                      {...register("registrationNumber")}
                    />
                  )}
                </Field>
                <Controller
                  control={control}
                  name="registrationDocument"
                  render={({ field }) => (
                    <DocumentField
                      label={registration.required ? "Certificate of incorporation" : "Udyam certificate"}
                      required={registration.required}
                      folder="compliance"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.registrationDocument?.message}
                      disabled={locked}
                    />
                  )}
                />
              </div>
            ) : (
              <Notice status="info" title="Choose your form of business first">
                It decides which registration GoDND needs — a CIN, an LLPIN or an Udyam number.{" "}
                <button type="button" className="link-btn" onClick={() => navigate("/dashboard/settings/basic-info")}>
                  Go to Basic Info
                </button>
              </Notice>
            )}
          </fieldset>

          <Controller
            control={control}
            name="termsAccepted"
            render={({ field }) => (
              <div className="field">
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                  describedBy={errors.termsAccepted ? "terms-error" : undefined}
                  label="I confirm these details are correct and that I’m authorised to act for this business."
                />
                <FieldError id="terms-error" message={errors.termsAccepted?.message} />
              </div>
            )}
          />
        </fieldset>
      </form>
    </SectionFrame>
  );
}
