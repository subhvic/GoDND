"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";

import { useInbox } from "@/components/enquiries/inbox-provider";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { dayKey } from "@/lib/enquiries/format";
import { newEnquiryDefaults, newEnquirySchema, type NewEnquiryInput } from "@/lib/enquiries/schema";

const SOURCES: { value: NewEnquiryInput["source"]; label: string }[] = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "manual", label: "Walk-in or in person" },
  { value: "referral", label: "Referral" },
];

/**
 * "Log enquiry" — for the leads that never touched a website: a phone call,
 * a WhatsApp message, someone at the counter. Logging them here puts them in
 * the same inbox, pipeline and response-time clock as everything else, which
 * is the only way the numbers mean anything.
 */
export function LogEnquiryButton() {
  const [open, setOpen] = useState(false);
  const formId = useId();

  return (
    <>
      <button type="button" className={buttonClass({ variant: "primary" })} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        <span className="hidden sm:inline">Log enquiry</span>
        <span className="sm:hidden">Log</span>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Log an enquiry"
        description="For enquiries that came in by phone, WhatsApp or in person. It joins the inbox as New, assigned to you."
        footer={
          <>
            <button type="button" className={buttonClass()} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form={formId} className={buttonClass({ variant: "primary" })}>
              Log enquiry
            </button>
          </>
        }
      >
        <LogEnquiryForm formId={formId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function LogEnquiryForm({ formId, onDone }: { formId: string; onDone: () => void }) {
  const router = useRouter();
  const { createEnquiry, experiences, now } = useInbox();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewEnquiryInput>({
    resolver: zodResolver(newEnquirySchema),
    defaultValues: newEnquiryDefaults,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createEnquiry(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onDone();
    router.push(`/dashboard/enquiries/${encodeURIComponent(result.data)}`);
  });

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="log-form" aria-busy={isSubmitting}>
      {serverError ? (
        <Notice status="critical" title="The enquiry wasn't logged" role="alert">
          {serverError}
        </Notice>
      ) : null}

      <fieldset className="log-form-section">
        <legend className="form-section-title">Traveller</legend>
        <Field label="Name" required error={errors.contactName?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} describedBy={describedBy} invalid={invalid} autoComplete="off" autoFocus {...register("contactName")} />
          )}
        </Field>
        <div className="form-grid-2">
          <Field label="Phone" error={errors.contactPhone?.message} hint="Phone or email — at least one">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="tel" inputMode="tel" autoComplete="off" describedBy={describedBy} invalid={invalid} placeholder="+91 98765 43210" {...register("contactPhone")} />
            )}
          </Field>
          <Field label="Email" error={errors.contactEmail?.message} hint="Needed to reply from the inbox">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="email" inputMode="email" autoComplete="off" describedBy={describedBy} invalid={invalid} {...register("contactEmail")} />
            )}
          </Field>
        </div>
        <Field label="How they got in touch">
          {({ id }) => (
            <Select id={id} {...register("source")}>
              {SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>

      <fieldset className="log-form-section">
        <legend className="form-section-title">What they&rsquo;re after</legend>
        <Field label="Experience">
          {({ id }) => (
            <Select id={id} {...register("experienceId")}>
              <option value="">Not decided yet</option>
              {experiences.map((experience) => (
                <option key={experience.id} value={experience.id}>
                  {experience.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="form-grid-2 items-end">
          <Field label="Preferred start" error={errors.preferredStart?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="date" min={dayKey(now)} describedBy={describedBy} invalid={invalid} {...register("preferredStart")} />
            )}
          </Field>
          <Controller
            control={control}
            name="flexibleDates"
            render={({ field }) => (
              <Checkbox label="Dates are flexible" checked={field.value} onChange={field.onChange} className="pb-[8px]" />
            )}
          />
        </div>
        <div className="form-grid-3">
          <Field label="Adults" required error={errors.adults?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={1} max={99} describedBy={describedBy} invalid={invalid} {...register("adults", { valueAsNumber: true })} />
            )}
          </Field>
          <Field label="Children" error={errors.children?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={0} max={99} describedBy={describedBy} invalid={invalid} {...register("children", { valueAsNumber: true })} />
            )}
          </Field>
          <Field label="Infants" error={errors.infants?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="number" inputMode="numeric" min={0} max={99} describedBy={describedBy} invalid={invalid} {...register("infants", { valueAsNumber: true })} />
            )}
          </Field>
        </div>
        <Field label="Budget" error={errors.budget?.message} hint="Optional — for the whole group">
          {({ id, describedBy, invalid }) => (
            <AffixInput id={id} prefix="₹" inputMode="numeric" describedBy={describedBy} invalid={invalid} {...register("budget")} />
          )}
        </Field>
        <Field label="What they asked for" error={errors.message?.message} hint="In their words if you can — it opens the conversation">
          {({ id, describedBy, invalid }) => (
            <TextArea id={id} rows={3} describedBy={describedBy} invalid={invalid} {...register("message")} />
          )}
        </Field>
      </fieldset>
    </form>
  );
}
