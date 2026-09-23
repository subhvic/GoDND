"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { ZodType } from "zod";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import type { ExperienceDraft } from "@/lib/experience-wizard/schema";
import { adjacentSteps, type WizardStepSlug } from "@/lib/experience-wizard/steps";

/**
 * Shared wiring for all seven steps: validate on submit, write the section
 * into the wizard draft, tick the rail, then move on.
 *
 * Validation runs on submit rather than on change. A form that turns red while
 * you are still typing the first field is hostile; `reValidateMode` then
 * corrects errors live once the operator has seen them, which is the pairing
 * that actually helps.
 */
export function useStepForm<K extends keyof ExperienceDraft, TValues extends FieldValues>({
  sectionKey,
  slug,
  schema,
  onComplete,
}: {
  sectionKey: K;
  slug: WizardStepSlug;
  schema: ZodType<TValues>;
  /** Final step only: runs instead of navigating to a next step. */
  onComplete?: (values: TValues) => void | Promise<void>;
}) {
  const { draft, setSection, markComplete } = useWizard();
  const router = useRouter();
  const { next } = adjacentSteps(slug);

  const form = useForm<TValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema
    // and the section are matched by construction at each call site; the
    // resolver's generics cannot express that link.
    resolver: zodResolver(schema as any),
    defaultValues: draft[sectionKey] as unknown as DefaultValues<TValues>,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSection(sectionKey, values as unknown as ExperienceDraft[K]);
    markComplete(slug, true);

    if (onComplete) {
      await onComplete(values);
      return;
    }

    if (next) router.push(`/dashboard/experiences/new/${next.slug}`);
  });

  /**
   * Announced when a submit fails. Screen reader users otherwise get no signal
   * that anything happened, since the errors are scattered down the form.
   */
  const errorCount = Object.keys(form.formState.errors).length;
  const errorSummary =
    form.formState.isSubmitted && errorCount > 0
      ? `${errorCount} field${errorCount === 1 ? "" : "s"} need${
          errorCount === 1 ? "s" : ""
        } attention before you can continue.`
      : "";

  return { form, handleSubmit, errorSummary };
}
