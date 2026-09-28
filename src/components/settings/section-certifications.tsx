"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Award, Flag, Pencil, Plus, Trash2 } from "lucide-react";

import { DocumentField } from "@/components/settings/document-field";
import { ReviewBanner, SectionFrame } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import {
  EditAction,
  ErrorSummary,
  ReviewedFooter,
  useReviewedSection,
} from "@/components/settings/use-reviewed-section";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import type { Certificate, CertificationsValues, DocumentRef } from "@/lib/settings/model";
import { CERTIFICATE_TYPES, certificateTypeLabel, type CertificateType } from "@/lib/settings/options";
import { certificateExpiry } from "@/lib/settings/rules";
import { certificationsSchema } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";

/** Settings › Certifications & Accreditations (step 4 of 7). */
export function SectionCertifications() {
  const { today } = useSettings();
  const api = useReviewedSection({
    sectionKey: "certifications",
    slug: "certifications",
    schema: certificationsSchema,
    toForm: (values: CertificationsValues) => values,
    fromForm: (values: CertificationsValues) => values,
  });
  const { form, locked, record } = api;
  const certificates = useWatch({ control: form.control, name: "certificates" }) ?? [];
  const [editing, setEditing] = useState<Certificate | "new" | null>(null);
  const errors = form.formState.errors;
  const listError =
    (errors.certificates as { message?: string; root?: { message?: string } } | undefined)?.message ??
    (errors.certificates as { root?: { message?: string } } | undefined)?.root?.message;

  const setCertificates = (next: Certificate[]) =>
    form.setValue("certificates", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

  const flagged = (certificate: Certificate) =>
    record.status === "changes_requested" && record.flaggedFields.includes(`certificates.${certificate.id}`);

  return (
    <SectionFrame
      slug="certifications"
      action={<EditAction api={api} />}
      banner={<ReviewBanner slug="certifications" record={record} editing={api.editing} />}
      footer={<ReviewedFooter slug="certifications" api={api} />}
    >
      <ErrorSummary message={api.errorSummary} />
      <form id={api.formId} onSubmit={api.submit} noValidate className="settings-form">
        <div className="flex flex-wrap items-center justify-between gap-[8px]">
          <p className="m-0 text-[12px] text-text-muted">
            {certificates.length === 0
              ? "Your state tourism registration is usually enough to start."
              : `${certificates.length} certificate${certificates.length === 1 ? "" : "s"}. GoDND reminds you 60 days before one expires.`}
          </p>
          {!locked && certificates.length > 0 ? (
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              Add certificate
            </Button>
          ) : null}
        </div>

        {certificates.length === 0 ? (
          <div className="cert-empty">
            <Award aria-hidden />
            <p className="m-0 text-[13px] font-medium text-text-primary">No certificates added</p>
            <p className="m-0 text-[12px] text-text-muted">
              Registrations, association memberships, licences and first-aid training all count.
            </p>
            {!locked ? (
              <Button variant="primary" onClick={() => setEditing("new")} className="mt-[6px]">
                <Plus aria-hidden />
                Add certificate
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="cert-list">
            {certificates.map((certificate, index) => {
              const expiry = certificateExpiry(certificate.validUntil, today);
              const itemErrors = (errors.certificates as Record<number, Record<string, { message?: string }>> | undefined)?.[index];
              const problem = itemErrors ? Object.values(itemErrors).find((entry) => entry?.message)?.message : null;
              const isFlagged = flagged(certificate);
              const title = certificate.type === "other" ? certificate.name || "Other" : certificateTypeLabel(certificate.type);
              return (
                <li key={certificate.id} className={cn("cert-card", (isFlagged || problem) && "is-flagged")}>
                  <div className="cert-main">
                    <div className="flex flex-wrap items-center gap-[6px]">
                      <h3 className="cert-title">{title}</h3>
                      <Badge status={expiry.status === "healthy" ? "neutral" : expiry.status}>{expiry.label}</Badge>
                      {isFlagged ? (
                        <span className="cert-flag">
                          <Flag aria-hidden />
                          Flagged by GoDND
                        </span>
                      ) : null}
                    </div>
                    <p className="cert-meta">
                      {certificate.number} · {certificate.issuer}
                    </p>
                    {certificate.document ? (
                      <CertificateDocument document={certificate.document} />
                    ) : (
                      <p className="cert-meta text-critical-fg">No document attached</p>
                    )}
                    {problem ? (
                      <p role="alert" className="field-error">
                        {problem}
                      </p>
                    ) : null}
                  </div>
                  {!locked ? (
                    <div className="cert-actions">
                      <Button size="small" onClick={() => setEditing(certificate)} aria-label={`Edit ${title}`}>
                        <Pencil aria-hidden />
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="danger"
                        onClick={() => setCertificates(certificates.filter((entry) => entry.id !== certificate.id))}
                        aria-label={`Remove ${title}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {listError ? (
          <p role="alert" className="field-error">
            {listError}
          </p>
        ) : null}
      </form>

      {editing ? (
        <CertificateDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(certificate) => {
            const exists = certificates.some((entry) => entry.id === certificate.id);
            setCertificates(
              exists
                ? certificates.map((entry) => (entry.id === certificate.id ? certificate : entry))
                : [...certificates, certificate],
            );
            setEditing(null);
          }}
        />
      ) : null}
    </SectionFrame>
  );
}

function CertificateDocument({ document }: { document: DocumentRef }) {
  const href = document.previewUrl ?? (document.path ? `/dashboard/settings/file?path=${encodeURIComponent(document.path)}` : null);
  return href ? (
    <a className="cert-doc link-btn" href={href} target="_blank" rel="noopener noreferrer">
      {document.name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <span className="cert-doc" title="Sample document — nothing is stored in this preview">
      {document.name}
    </span>
  );
}

type CertificateForm = {
  type: CertificateType | "";
  name: string;
  number: string;
  issuer: string;
  validUntil: string;
  noExpiry: boolean;
  document: DocumentRef | null;
};

function dialogSchema(today: string) {
  return z
    .object({
      type: z.string().min(1, "Choose what kind of certificate this is"),
      name: z.string().trim().max(120),
      number: z.string().trim().min(1, "Certificate or registration number is required").max(60),
      issuer: z.string().trim().min(1, "Issuing body is required").max(120),
      validUntil: z.string(),
      noExpiry: z.boolean(),
      document: z.unknown().refine((value) => value !== null, "Upload the certificate"),
    })
    .superRefine((values, ctx) => {
      if (values.type === "other" && !values.name.trim()) {
        ctx.addIssue({ code: "custom", path: ["name"], message: "Name the certificate" });
      }
      if (!values.noExpiry) {
        if (!values.validUntil) {
          ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Choose the expiry date, or tick “Doesn’t expire”" });
        } else if (values.validUntil < today) {
          ctx.addIssue({
            code: "custom",
            path: ["validUntil"],
            message: "That date has passed — add the renewed certificate instead",
          });
        }
      }
    });
}

function CertificateDialog({
  initial,
  today,
  onClose,
  onSave,
}: {
  initial: Certificate | null;
  today: string;
  onClose: () => void;
  onSave: (certificate: Certificate) => void;
}) {
  const form = useForm<CertificateForm>({
    resolver: zodResolver(dialogSchema(today)) as unknown as Resolver<CertificateForm>,
    defaultValues: initial
      ? {
          type: initial.type,
          name: initial.name,
          number: initial.number,
          issuer: initial.issuer,
          // An expired date is cleared rather than shown: the renewal is
          // what goes here, and the old date is still on the card.
          validUntil: initial.validUntil && initial.validUntil >= today ? initial.validUntil : "",
          noExpiry: initial.validUntil === null,
          document: initial.validUntil && initial.validUntil < today ? null : initial.document,
        }
      : { type: "", name: "", number: "", issuer: "", validUntil: "", noExpiry: false, document: null },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { register, control } = form;
  const errors = form.formState.errors;
  const [type, noExpiry] = useWatch({ control, name: ["type", "noExpiry"] });
  const expired = Boolean(initial?.validUntil && initial.validUntil < today);

  const save = form.handleSubmit((values) => {
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      type: values.type as CertificateType,
      name: values.type === "other" ? values.name.trim() : "",
      number: values.number.trim(),
      issuer: values.issuer.trim(),
      validUntil: values.noExpiry ? null : values.validUntil,
      document: values.document,
    });
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={initial ? "Edit certificate" : "Add certificate"}
      description={
        expired ? "This one has expired. Enter the renewed certificate’s details and upload it." : undefined
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            {initial ? "Save certificate" : "Add certificate"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        noValidate
        className="flex flex-col gap-[14px]"
      >
        <div className="settings-grid">
          <Field label="Type" required error={errors.type?.message}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                {...register("type", {
                  onChange: (event) => {
                    const next = CERTIFICATE_TYPES.find((entry) => entry.value === event.target.value);
                    const previous = CERTIFICATE_TYPES.find((entry) => entry.value === type);
                    const issuer = form.getValues("issuer");
                    if (next?.issuer && (!issuer || issuer === previous?.issuer)) form.setValue("issuer", next.issuer);
                  },
                })}
              >
                <option value="">Select</option>
                {CERTIFICATE_TYPES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {type === "other" ? (
            <Field label="Certificate name" required error={errors.name?.message}>
              {({ id, describedBy, invalid }) => (
                <TextInput id={id} describedBy={describedBy} invalid={invalid} {...register("name")} />
              )}
            </Field>
          ) : (
            <span className="hidden lg:block" aria-hidden />
          )}
          <Field label="Certificate or registration number" required error={errors.number?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} describedBy={describedBy} invalid={invalid} autoComplete="off" {...register("number")} />
            )}
          </Field>
          <Field label="Issued by" required error={errors.issuer?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                placeholder="Directorate of Tourism, Meghalaya"
                {...register("issuer")}
              />
            )}
          </Field>
          <div className="field">
            <Field label="Valid until" required={!noExpiry} error={errors.validUntil?.message}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  type="date"
                  min={today}
                  disabled={noExpiry}
                  {...register("validUntil")}
                />
              )}
            </Field>
            <Controller
              control={control}
              name="noExpiry"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onChange={(checked) => {
                    field.onChange(checked);
                    if (checked) form.setValue("validUntil", "");
                  }}
                  label="Doesn’t expire"
                />
              )}
            />
          </div>
        </div>
        <Controller
          control={control}
          name="document"
          render={({ field }) => (
            <DocumentField
              label="Certificate"
              required
              folder="certifications"
              value={field.value}
              onChange={field.onChange}
              error={errors.document?.message}
            />
          )}
        />
      </form>
    </Dialog>
  );
}
