"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState, useTransition } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { ArrowRight, Mail } from "lucide-react";

import { confirmEmailChange, requestEmailChange } from "@/app/dashboard/settings/actions";
import { DocumentField } from "@/components/settings/document-field";
import { FooterNav, SectionFrame } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import { ErrorSummary } from "@/components/settings/use-reviewed-section";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS } from "@/lib/auth/config";
import { adjacentSections, type ProfileValues } from "@/lib/settings/model";
import { ROLES } from "@/lib/settings/options";
import { applySettingsAction, isProfileComplete } from "@/lib/settings/rules";
import { profileSchema } from "@/lib/settings/schema";

/** Settings › My Profile (step 6 of 7). Saves directly — GoDND doesn’t check it. */
export function SectionProfile() {
  const { state, run, setDirty, navigate, busy } = useSettings();
  const [formError, setFormError] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const role = ROLES.find((entry) => entry.value === state.viewer.role);
  const complete = isProfileComplete(state.profile.values);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileValues>,
    defaultValues: state.profile.values,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { register, control } = form;
  const errors = form.formState.errors;
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const save = form.handleSubmit(async (values) => {
    setFormError(null);
    const wasComplete = complete;
    const result = await run({ type: "save_profile", values });
    if (!result.ok) {
      setFormError(result.error);
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(path as keyof ProfileValues, { type: "server", message });
      }
      return;
    }
    form.reset(result.state.profile.values);
    setDirty(false);
    const { next } = adjacentSections("profile");
    if (!wasComplete && next) navigate(`/dashboard/settings/${next.slug}`);
  });

  return (
    <SectionFrame
      slug="profile"
      footer={
        <FooterNav slug="profile">
          <Button variant="primary" type="submit" form="settings-profile" disabled={busy}>
            {complete ? "Save changes" : "Save & next step"}
            {complete ? null : <ArrowRight aria-hidden />}
          </Button>
        </FooterNav>
      }
    >
      <ErrorSummary
        message={
          formError ??
          (form.formState.isSubmitted && Object.keys(errors).length > 0 ? "Check the highlighted fields." : null)
        }
      />
      <form id="settings-profile" onSubmit={save} noValidate className="settings-form">
        <Controller
          control={control}
          name="avatar"
          render={({ field }) => (
            <DocumentField
              label="Profile photo"
              image
              folder="profile"
              value={field.value}
              onChange={field.onChange}
              hint="Travellers see it on trips you captain."
            />
          )}
        />

        <div className="settings-grid">
          <Field label="Full name" required error={errors.fullName?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                autoComplete="name"
                {...register("fullName")}
              />
            )}
          </Field>
          <Field label="Designation" error={errors.designation?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                autoComplete="organization-title"
                placeholder="Operations lead (optional)"
                {...register("designation")}
              />
            )}
          </Field>
          <Field
            label="Phone number"
            required
            error={errors.phone?.message}
            hint="GoDND and your team call this on trip days."
          >
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

          <div className="field">
            <span className="field-label">Sign-in email</span>
            <div className="readonly-row">
              <Mail aria-hidden />
              <span className="min-w-0 truncate">{state.profile.email}</span>
              <button type="button" className="link-btn ml-auto shrink-0" onClick={() => setChangingEmail(true)}>
                Change
              </button>
            </div>
            <p className="field-hint">Your sign-in code is sent here.</p>
          </div>

          <div className="field span-2">
            <span className="field-label">Role</span>
            <p className="m-0 text-[12.5px] text-text-primary">
              {role?.label}
              <span className="text-text-muted"> — {role?.description}</span>
            </p>
            <p className="field-hint">
              {state.viewer.role === "owner"
                ? "Ownership moves only if you transfer it."
                : "An owner or admin can change it in My Team."}
            </p>
          </div>
        </div>
      </form>

      {changingEmail ? <EmailChangeDialog onClose={() => setChangingEmail(false)} /> : null}
    </SectionFrame>
  );
}

/**
 * Two steps in one dialog: the new address, then the code sent to it. The
 * old address keeps working until the code is entered, so a typo costs a
 * retry rather than the account.
 */
function EmailChangeDialog({ onClose }: { onClose: () => void }) {
  const { state, replaceState, notify, isDemo } = useSettings();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const emailId = useId();
  const codeId = useId();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = (address: string) =>
    startTransition(async () => {
      setError(null);
      const result = await requestEmailChange(address);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSentTo(address.trim().toLowerCase());
      setInfo(result.message);
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    });

  const verify = () =>
    startTransition(async () => {
      if (!sentTo) return;
      setError(null);
      const result = await confirmEmailChange(sentTo, code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.state) {
        replaceState(result.state);
      } else {
        const local = applySettingsAction(state, { type: "change_email", email: sentTo }, {
          now: new Date(),
          actorName: "",
          newId: () => "",
        });
        if (local.ok) replaceState(local.state);
      }
      notify(result.message);
      onClose();
    });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={sentTo ? "Enter the code" : "Change sign-in email"}
      description={
        sentTo
          ? `Sent to ${sentTo}. Your current address keeps working until you enter it.`
          : `You sign in with ${state.profile.email} today. We’ll send a code to the new address to prove it’s yours.`
      }
      footer={
        sentTo ? (
          <>
            <Button
              onClick={() => {
                setSentTo(null);
                setCode("");
                setError(null);
              }}
            >
              Use a different address
            </Button>
            <Button variant="primary" onClick={verify} disabled={pending || code.length !== OTP_LENGTH}>
              {pending ? "Checking…" : "Confirm new email"}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => send(email)} disabled={pending || !email.trim()}>
              {pending ? "Sending…" : "Send code"}
            </Button>
          </>
        )
      }
    >
      {sentTo ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === OTP_LENGTH) verify();
          }}
          className="flex flex-col gap-[12px]"
        >
          <label htmlFor={codeId} className="field-label">
            {OTP_LENGTH}-digit code
          </label>
          <OtpInput
            id={codeId}
            value={code}
            onChange={setCode}
            invalid={Boolean(error)}
            busy={pending}
            describedBy={error ? `${codeId}-error` : undefined}
            autoFocus
          />
          {error ? (
            <p id={`${codeId}-error`} role="alert" className="field-error">
              {error}
            </p>
          ) : null}
          {info && isDemo ? <p className="field-hint m-0">{info}</p> : null}
          <p className="m-0 text-[12px] text-text-secondary">
            Didn’t get it?{" "}
            <button type="button" className="link-btn" disabled={cooldown > 0 || pending} onClick={() => send(sentTo)}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </p>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim()) send(email);
          }}
          className="field"
        >
          <label htmlFor={emailId} className="field-label">
            New email address
          </label>
          <TextInput
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(error)}
            describedBy={error ? `${emailId}-error` : undefined}
            autoFocus
          />
          {error ? (
            <p id={`${emailId}-error`} role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
