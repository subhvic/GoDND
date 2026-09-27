"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import type { ZodType } from "zod";
import { ArrowRight, Pencil, Send } from "lucide-react";

import { FooterNav, NextStepButton } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import { Button } from "@/components/ui/button";
import {
  adjacentSections,
  type ReviewedKey,
  type ReviewedSection,
  type ReviewedSlug,
  type ReviewedValues,
} from "@/lib/settings/model";
import { canEditSection } from "@/lib/settings/rules";

/**
 * Shared wiring for the five sections GoDND verifies.
 *
 * - Save draft stores what's typed, without validation.
 * - Submit validates, sends to GoDND, and moves on to the next section.
 * - A sent section is read-only until "Edit details". Its edits are then
 *   submitted or cancelled — never parked as a draft over the version GoDND
 *   checked — so there is only ever one version of a section to reason about.
 *
 * Validation runs on submit and re-checks live once an error is showing,
 * the same pairing the experience wizard uses.
 */
export function useReviewedSection<K extends ReviewedKey, F extends FieldValues>({
  sectionKey,
  slug,
  schema,
  toForm,
  fromForm,
}: {
  sectionKey: K;
  slug: ReviewedSlug;
  /** Validates the form's values on submit; the output isn't used. */
  schema: ZodType;
  toForm: (values: ReviewedValues[K]) => F;
  fromForm: (values: F) => ReviewedValues[K];
}) {
  const { state, run, setDirty, navigate, busy } = useSettings();
  const record = state[sectionKey] as ReviewedSection<ReviewedValues[K]>;
  const canEdit = canEditSection(state.viewer.role, sectionKey);
  const sent = record.status === "submitted" || record.status === "verified";
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const locked = !canEdit || (sent && !editing);

  // The schema can depend on other sections (Compliance on the business
  // type), so the resolver reads the latest one rather than the first.
  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  const form = useForm<F>({
    resolver: ((values, context, options) =>
      (zodResolver(schemaRef.current as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<F>)(
        values,
        context,
        options,
      )) as Resolver<F>,
    defaultValues: toForm(record.values) as DefaultValues<F>,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    setDirty(isDirty && !locked);
  }, [isDirty, locked, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const applyFieldErrors = (fieldErrors?: Record<string, string>) => {
    for (const [path, message] of Object.entries(fieldErrors ?? {})) {
      form.setError(path as Path<F>, { type: "server", message });
    }
  };

  const settle = (next: ReviewedSection<ReviewedValues[K]>) => {
    form.reset(toForm(next.values) as DefaultValues<F>);
    setDirty(false);
  };

  const saveDraft = async () => {
    form.clearErrors();
    setFormError(null);
    const result = await run({ type: "save_section", section: sectionKey, values: fromForm(form.getValues()), submit: false });
    if (!result.ok) {
      setFormError(result.error);
      applyFieldErrors(result.fieldErrors);
      return;
    }
    settle(result.state[sectionKey] as ReviewedSection<ReviewedValues[K]>);
  };

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const wasSent = sent;
    const result = await run({ type: "save_section", section: sectionKey, values: fromForm(values), submit: true });
    if (!result.ok) {
      setFormError(result.error);
      applyFieldErrors(result.fieldErrors);
      return;
    }
    settle(result.state[sectionKey] as ReviewedSection<ReviewedValues[K]>);
    setEditing(false);
    const { next } = adjacentSections(slug);
    if (!wasSent && next) navigate(`/dashboard/settings/${next.slug}`);
  });

  const cancelEdit = () => {
    form.reset(toForm(record.values) as DefaultValues<F>);
    form.clearErrors();
    setFormError(null);
    setEditing(false);
  };

  const errorCount = Object.keys(form.formState.errors).length;
  const errorSummary =
    formError ??
    (form.formState.isSubmitted && errorCount > 0
      ? `${errorCount} field${errorCount === 1 ? " needs" : "s need"} attention before this can be sent.`
      : null);

  return {
    form,
    record,
    canEdit,
    sent,
    editing,
    locked,
    busy,
    errorSummary,
    formId: `settings-${slug}`,
    startEdit: () => setEditing(true),
    cancelEdit,
    saveDraft,
    submit,
  };
}

/** The parts of a section the shared title action and footer drive. */
export type ReviewedSectionApi = Pick<
  ReturnType<typeof useReviewedSection>,
  "canEdit" | "sent" | "editing" | "locked" | "busy" | "formId" | "startEdit" | "cancelEdit" | "saveDraft"
>;

/** "Edit details" beside the title of a sent section, or a view-only tag. */
export function EditAction({ api, restrictedLabel }: { api: ReviewedSectionApi; restrictedLabel?: string }) {
  if (!api.canEdit) {
    return <span className="badge neutral">{restrictedLabel ?? "View only"}</span>;
  }
  if (api.sent && !api.editing) {
    return (
      <Button onClick={api.startEdit}>
        <Pencil aria-hidden />
        Edit details
      </Button>
    );
  }
  return null;
}

/**
 * Three footers, by where the section stands:
 *   unsent  — Previous · Save draft · Submit & continue
 *   editing — Cancel · Submit changes
 *   sent    — Previous · Next step
 */
export function ReviewedFooter({
  slug,
  api,
  onSubmitChanges,
}: {
  slug: ReviewedSlug;
  api: ReviewedSectionApi;
  /** Intercepts Submit changes — Financial asks first, because payouts pause. */
  onSubmitChanges?: () => void;
}) {
  if (api.locked) {
    return (
      <FooterNav slug={slug}>
        <NextStepButton slug={slug} />
      </FooterNav>
    );
  }

  if (api.editing) {
    return (
      <FooterNav slug={slug} left={<Button onClick={api.cancelEdit}>Cancel</Button>}>
        <Button
          variant="primary"
          type={onSubmitChanges ? "button" : "submit"}
          form={api.formId}
          disabled={api.busy}
          onClick={onSubmitChanges}
        >
          <Send aria-hidden />
          Submit changes
        </Button>
      </FooterNav>
    );
  }

  return (
    <FooterNav slug={slug}>
      <Button onClick={api.saveDraft} disabled={api.busy}>
        Save draft
      </Button>
      <Button variant="primary" type="submit" form={api.formId} disabled={api.busy}>
        Submit &amp; next step
        <ArrowRight aria-hidden />
      </Button>
    </FooterNav>
  );
}

/** The live region a failed submit speaks through. */
export function ErrorSummary({ message }: { message: string | null }) {
  return (
    <p aria-live="assertive" className={message ? "field-error settings-error" : "sr-only"}>
      {message}
    </p>
  );
}
