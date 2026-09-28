"use client";

import { useMemo, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Lock } from "lucide-react";

import { DocumentField } from "@/components/settings/document-field";
import { FooterNav, NextStepButton, ReviewBanner, SectionFrame } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import {
  EditAction,
  ErrorSummary,
  ReviewedFooter,
  useReviewedSection,
} from "@/components/settings/use-reviewed-section";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, RadioGroup, TextInput } from "@/components/ui/field";
import type { FinancialValues } from "@/lib/settings/model";
import { bankForIfsc } from "@/lib/settings/options";
import { can } from "@/lib/settings/rules";
import { cleanId, financialFormSchema } from "@/lib/settings/schema";

type FinancialForm = FinancialValues & { confirmAccountNumber: string };

export const maskAccount = (number: string) => (number ? `•••• •••• ${number.slice(-4)}` : "");

const sameName = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Settings › Financial Details (step 3 of 7). */
export function SectionFinancial() {
  const { state } = useSettings();
  if (!can(state.viewer.role, "view_financial")) return <RestrictedFinancial />;
  return <FinancialEditor />;
}

function FinancialEditor() {
  const { state } = useSettings();
  const saved = state.financial.values.accountNumber;
  const schema = useMemo(() => financialFormSchema(saved), [saved]);
  const [confirming, setConfirming] = useState(false);

  const api = useReviewedSection({
    sectionKey: "financial",
    slug: "financial",
    schema,
    toForm: (values: FinancialValues): FinancialForm => ({ ...values, confirmAccountNumber: "" }),
    fromForm: (values: FinancialForm): FinancialValues => ({
      accountHolder: values.accountHolder,
      accountNumber: values.accountNumber,
      ifsc: values.ifsc,
      accountType: values.accountType,
      proof: values.proof,
    }),
  });
  const { form, locked } = api;
  const { register, control } = form;
  const errors = form.formState.errors;
  const [accountNumber, ifsc, accountHolder, accountType] = useWatch({
    control,
    name: ["accountNumber", "ifsc", "accountHolder", "accountType"],
  });

  const bank = bankForIfsc(cleanId(ifsc ?? ""));
  const legalName = state.basicInfo.values.legalName;
  const holderMismatch =
    Boolean(accountHolder?.trim() && legalName) && !sameName(accountHolder ?? "", legalName);
  const numberChanged = (accountNumber ?? "").trim() !== saved;
  const savedBank = bankForIfsc(state.financial.values.ifsc);

  return (
    <SectionFrame
      slug="financial"
      action={<EditAction api={api} restrictedLabel="View only" />}
      banner={
        <ReviewBanner
          slug="financial"
          record={api.record}
          editing={api.editing}
          editConsequence="Payouts to your current account pause until GoDND verifies the new one. Bookings carry on as normal."
        />
      }
      footer={
        <ReviewedFooter
          slug="financial"
          api={api}
          onSubmitChanges={() => {
            // Validate first, so the confirmation is never the thing that
            // hides a mistyped IFSC.
            void form.trigger().then((valid) => {
              if (valid) setConfirming(true);
            });
          }}
        />
      }
    >
      <ErrorSummary message={api.errorSummary} />
      <form id={api.formId} onSubmit={api.submit} noValidate className="settings-form">
        <fieldset disabled={locked}>
          <div className="settings-grid">
            <Field
              label="Account holder name"
              required
              error={errors.accountHolder?.message}
              hint={
                holderMismatch
                  ? `Doesn’t match your legal name, ${legalName}. GoDND may ask for proof that this account is the business’s.`
                  : "As printed on your cheque book or passbook."
              }
              className="span-2"
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  autoComplete="off"
                  placeholder="Name on the account"
                  {...register("accountHolder")}
                />
              )}
            </Field>

            {locked ? (
              <Field label="Account number">
                {({ id }) => (
                  <div className="input-wrap">
                    <input id={id} value={maskAccount(saved)} readOnly aria-label="Account number, last four digits shown" />
                    <span className="input-affix suffix" aria-hidden>
                      <Lock className="size-[12px]" />
                    </span>
                  </div>
                )}
              </Field>
            ) : (
              <Field label="Account number" required error={errors.accountNumber?.message}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={18}
                    placeholder="9 to 18 digits"
                    {...register("accountNumber")}
                  />
                )}
              </Field>
            )}

            {!locked && numberChanged ? (
              <Field label="Re-enter account number" required error={errors.confirmAccountNumber?.message}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={18}
                    {...register("confirmAccountNumber")}
                  />
                )}
              </Field>
            ) : (
              <span className="hidden lg:block" aria-hidden />
            )}

            <Field
              label="IFSC"
              required
              error={errors.ifsc?.message}
              hint={bank ? bank : "On your cheque leaf, or your bank’s website."}
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  className="uppercase"
                  maxLength={11}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SBIN0001234"
                  {...register("ifsc")}
                />
              )}
            </Field>

            <RadioGroup
              legend="Account type"
              required
              value={accountType}
              onChange={(value) =>
                form.setValue("accountType", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
              }
              options={[
                { value: "current", label: "Current" },
                { value: "savings", label: "Savings" },
              ]}
              error={errors.accountType?.message}
            />
          </div>

          <Controller
            control={control}
            name="proof"
            render={({ field }) => (
              <DocumentField
                label="Cancelled cheque or bank statement"
                required
                folder="financial"
                value={field.value}
                onChange={field.onChange}
                error={errors.proof?.message}
                hint="It needs to show the account holder’s name and the account number."
                disabled={locked}
              />
            )}
          />
        </fieldset>
      </form>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        size="sm"
        title="Change the payout account?"
        description={
          savedBank
            ? `Payouts to ${savedBank} ${maskAccount(saved)} stop now and resume to the new account once GoDND verifies it.`
            : `Payouts to ${maskAccount(saved)} stop now and resume to the new account once GoDND verifies it.`
        }
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>Keep current account</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirming(false);
                void api.submit();
              }}
            >
              Submit new details
            </Button>
          </>
        }
      >
        <p className="m-0 text-[12.5px] leading-[1.55] text-text-secondary">
          Nothing already paid out is affected. Payouts due while the check runs are held, not lost.
        </p>
      </Dialog>
    </SectionFrame>
  );
}

/**
 * A role without access sees that the section exists and where it stands,
 * never the account — RLS keeps the row from them in the first place.
 */
function RestrictedFinancial() {
  const { state } = useSettings();
  return (
    <SectionFrame
      slug="financial"
      action={<span className="badge neutral">Owners, admins and finance</span>}
      banner={<ReviewBanner slug="financial" record={state.financial} editing={false} />}
      footer={
        <FooterNav slug="financial">
          <NextStepButton slug="financial" />
        </FooterNav>
      }
    >
      <div className="panel settings-restricted">
        <Lock aria-hidden />
        <div>
          <p className="m-0 text-[13px] font-medium text-text-primary">Bank details are kept to a few people</p>
          <p className="m-0 mt-[4px] text-[12px] text-text-muted">
            Only the owner, admins and finance can see or change where payouts go. Ask one of them if something
            needs updating.
          </p>
        </div>
      </div>
    </SectionFrame>
  );
}
