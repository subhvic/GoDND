"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Sparkles, Star, Upload } from "lucide-react";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Field, TextArea } from "@/components/ui/field";
import {
  REGION_OPTIONS,
  SAMPLE_MEDIA,
} from "@/lib/experience-wizard/options";
import { mediaSchema, type MediaValues } from "@/lib/experience-wizard/schema";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

const FORM_ID = "step-media";

/** Step 7 of 7 — Media & Overview, ending in "Send for Approval". */
export function StepMedia() {
  const { draft, reset } = useWizard();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { form, handleSubmit, errorSummary } = useStepForm<"media", MediaValues>({
    sectionKey: "media",
    slug: "media",
    schema: mediaSchema,
    onComplete: async () => {
      setSubmitting(true);
      const { submitExperienceForApproval } = await import(
        "@/app/dashboard/experiences/new/actions"
      );
      await submitExperienceForApproval(draft);
      reset();
      // Lands on Under Review, where the newly submitted experience now sits —
      // rather than Active, where it would be conspicuously absent.
      router.push("/dashboard/experiences?tab=under_review");
    },
  });

  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;
  const thumbnailId = watch("thumbnailId");
  const summary = watch("summary");

  return (
    <StepShell
      slug="media"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
      submitting={submitting}
      aside={<GuestCardPreview summary={summary} thumbnailId={thumbnailId} />}
    >
      <section aria-labelledby="thumbnail">
        <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
          <h3 id="thumbnail" className="text-body font-medium text-neutral-1">
            Set a Thumbnail Image
          </h3>
          <button
            type="button"
            className="text-small font-medium text-neutral-1 underline underline-offset-2"
          >
            See all {SAMPLE_MEDIA.length} images →
          </button>
        </div>
        <p className="mt-[4px] text-small text-neutral-2">
          Select from one of your uploaded images in the itinerary
        </p>

        {/*
          A radiogroup rather than a set of buttons: exactly one thumbnail can be
          chosen, and arrow-key navigation is what a keyboard user expects from
          a single-choice gallery.
        */}
        <div
          role="radiogroup"
          aria-labelledby="thumbnail"
          aria-describedby={errors.thumbnailId ? "thumbnail-error" : undefined}
          className="mt-[14px] flex flex-wrap gap-[12px]"
        >
          {SAMPLE_MEDIA.map((media) => {
            const isSelected = thumbnailId === media.id;
            return (
              <button
                key={media.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={media.alt}
                onClick={() =>
                  setValue("thumbnailId", media.id, {
                    shouldValidate: formState.isSubmitted,
                  })
                }
                className={cn(
                  "relative h-[74px] w-[112px] overflow-hidden border-2 transition-colors",
                  isSelected ? "border-brand" : "border-transparent hover:border-neutral-4",
                )}
              >
                {/*
                  Placeholder tiles: the file's photography is licensed stock
                  that this environment cannot download. Real uploads render
                  here once storage is wired.
                */}
                <span
                  aria-hidden
                  className="flex size-full items-center justify-center bg-gradient-to-br from-brand-soft to-brand-surface text-small text-ink-muted"
                >
                  {media.id.replace("media-", "")}
                </span>
              </button>
            );
          })}
        </div>

        {errors.thumbnailId ? (
          <p id="thumbnail-error" role="alert" className="mt-[8px] text-small text-[#d92d20]">
            {errors.thumbnailId.message}
          </p>
        ) : null}

        <p className="mt-[16px] text-small text-neutral-2">
          Or, you can upload a custom thumbnail
        </p>
        <button
          type="button"
          className="mt-[8px] flex items-center gap-[6px] text-small font-medium text-brand underline underline-offset-2"
        >
          <Upload aria-hidden className="size-[16px]" />
          Upload
        </button>
      </section>

      <section aria-labelledby="overview" className="mt-[10px]">
        <h3
          id="overview"
          className="border-b border-neutral-5 pb-[12px] text-h3 font-semibold text-neutral-1"
        >
          {draft.basicInfo.title || "Untitled experience"}
        </h3>

        <Field
          className="mt-[16px]"
          label="Add an Experience Summary"
          required
          error={errors.summary?.message}
          hint={`${summary?.length ?? 0}/600 characters`}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              rows={8}
              maxLength={600}
              placeholder="What makes this experience worth booking?"
              {...register("summary")}
            />
          )}
        </Field>
      </section>
    </StepShell>
  );
}

/** "Experience Preview for Your Guests" — the marketplace card, live. */
function GuestCardPreview({
  summary,
  thumbnailId,
}: {
  summary: string;
  thumbnailId: string;
}) {
  const { draft } = useWizard();
  const { basicInfo, pricing } = draft;

  const perPerson =
    pricing.pricingMode === "variable"
      ? Number(pricing.tiers[String(pricing.maxGuestsPerBooking)] ?? 0) /
        Math.max(pricing.maxGuestsPerBooking, 1)
      : Number(pricing.basePrice);

  return (
    <div>
      <h3 className="text-body font-medium text-neutral-1">
        Experience Preview for Your Guests
      </h3>
      <p className="mt-[2px] text-small text-brand">Experience Cards</p>

      <article className="mt-[16px] bg-white shadow-[0_2px_12px_rgba(7,29,24,0.08)]">
        <div
          aria-hidden
          className={cn(
            "flex h-[140px] items-center justify-center bg-gradient-to-br from-brand-soft to-brand-surface text-small text-ink-muted",
            !thumbnailId && "border-b border-dashed border-neutral-4",
          )}
        >
          {thumbnailId ? "" : "No thumbnail chosen"}
        </div>

        <div className="p-[14px]">
          <h4 className="text-small font-medium text-neutral-1">
            {basicInfo.title || "Untitled experience"}
          </h4>
          <p className="mt-[4px] text-small text-neutral-2">
            {formatDuration(basicInfo.durationDays, basicInfo.durationNights)} ·{" "}
            {regionLabels(basicInfo.regions) || "No region set"}
          </p>

          <div className="mt-[10px] flex flex-wrap items-center gap-[10px] text-small">
            {basicInfo.kind === "super" ? (
              <span className="flex items-center gap-[4px] text-[#7C3AED]">
                <Sparkles aria-hidden className="size-[12px]" />
                Super Experience
              </span>
            ) : null}
            <span className="flex items-center gap-[4px] text-brand">
              <BadgeCheck aria-hidden className="size-[12px]" />
              Certified Provider
            </span>
          </div>

          <p className="mt-[10px] flex items-center gap-[6px] text-small">
            <span className="font-medium text-neutral-1">New</span>
            <span aria-hidden className="flex">
              {[1, 2, 3, 4, 5].map((index) => (
                <Star key={index} className="size-[12px] text-neutral-3" />
              ))}
            </span>
            <span className="text-neutral-2">(no reviews yet)</span>
          </p>

          <p className="mt-[10px] line-clamp-3 text-small text-neutral-2">
            {summary || "Your summary appears here as guests will read it."}
          </p>

          <div className="mt-[14px] flex items-end justify-between gap-[10px]">
            <p>
              <span className="text-h3 font-semibold text-neutral-1">
                {formatMoney(perPerson * 100)}
              </span>
              <span className="block text-small text-neutral-2">per person</span>
            </p>
            <span className="text-small font-medium text-brand">Book Now →</span>
          </div>
        </div>
      </article>

      <p className="mt-[12px] text-small text-neutral-2">
        Ratings and review counts appear once this experience has completed
        bookings.
      </p>
    </div>
  );
}

function regionLabels(values: string[]) {
  return values
    .map((value) => REGION_OPTIONS.find((r) => r.value === value)?.label)
    .filter(Boolean)
    .join(", ");
}
