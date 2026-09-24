"use client";

import { useRouter } from "next/navigation";
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
  const { draft } = useWizard();
  const router = useRouter();

  const { form, handleSubmit, errorSummary } = useStepForm<"media", MediaValues>({
    sectionKey: "media",
    slug: "media",
    schema: mediaSchema,
    // Media is the last data-collection step, but not where the submit
    // fires: seven steps of work deserve a final look before it goes to a
    // reviewer, so we route to /review. That page owns the actual
    // submitExperienceForApproval() call and the flash write for the
    // confirmation screen.
    onComplete: () => {
      router.push("/dashboard/experiences/new/review");
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
      aside={<GuestCardPreview summary={summary} thumbnailId={thumbnailId} />}
    >
      <section aria-labelledby="thumbnail">
        <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
          <h3 id="thumbnail" className="form-section-title">
            Set a Thumbnail Image
          </h3>
          <button
            type="button"
            className="hbtn small"
          >
            See all {SAMPLE_MEDIA.length} images →
          </button>
        </div>
        <p className="mt-[4px] field-hint">
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
                  "relative h-[74px] w-[112px] overflow-hidden rounded-sm border-2 transition-colors",
                  isSelected ? "border-brand" : "border-border-subtle hover:border-border-strong",
                )}
              >
                {/*
                  Placeholder tiles: the file's photography is licensed stock
                  that this environment cannot download. Real uploads render
                  here once storage is wired.
                */}
                <span
                  aria-hidden
                  className="flex size-full items-center justify-center bg-gradient-to-br from-brand-muted to-panel text-[12px] text-text-secondary"
                >
                  {media.id.replace("media-", "")}
                </span>
              </button>
            );
          })}
        </div>

        {errors.thumbnailId ? (
          <p id="thumbnail-error" role="alert" className="mt-[8px] field-error">
            {errors.thumbnailId.message}
          </p>
        ) : null}

        <p className="mt-[16px] field-hint">
          Or, you can upload a custom thumbnail
        </p>
        <button
          type="button"
          className="hbtn brand-lit mt-[8px]"
        >
          <Upload aria-hidden />
          Upload
        </button>
      </section>

      <section aria-labelledby="overview" className="mt-[10px]">
        <h3
          id="overview"
          className="m-0 border-b border-border-subtle pb-[12px] text-[15px] font-semibold tracking-[-0.2px] text-text-primary"
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
      <h3 className="form-section-title">
        Experience Preview for Your Guests
      </h3>
      <p className="m-0 mt-[2px] text-[11px] text-text-muted">How it appears on the marketplace</p>

      <article className="mt-[16px] overflow-hidden rounded-lg border border-card-border bg-card shadow-[var(--card-shadow)]">
        <div
          aria-hidden
          className={cn(
            "flex h-[140px] items-center justify-center bg-gradient-to-br from-brand-muted to-panel text-[12px] text-text-secondary",
            !thumbnailId && "border-b border-dashed border-border-panel",
          )}
        >
          {thumbnailId ? "" : "No thumbnail chosen"}
        </div>

        <div className="p-[14px]">
          <h4 className="m-0 text-[13.5px] font-semibold text-text-primary">
            {basicInfo.title || "Untitled experience"}
          </h4>
          <p className="mt-[4px] field-hint">
            {formatDuration(basicInfo.durationDays, basicInfo.durationNights)} ·{" "}
            {regionLabels(basicInfo.regions) || "No region set"}
          </p>

          {/* Tier and trust labels are information, not severity, so they use
              the neutral badges — green, amber and red stay reserved. */}
          <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
            {basicInfo.kind === "super" ? (
              <span className="badge info gap-[4px]">
                <Sparkles aria-hidden className="size-[10px]" />
                Super experience
              </span>
            ) : null}
            <span className="badge neutral gap-[4px]">
              <BadgeCheck aria-hidden className="size-[10px]" />
              Certified provider
            </span>
          </div>

          <p className="mt-[10px] flex items-center gap-[6px] text-[12px]">
            <span className="font-medium text-text-primary">New</span>
            <span aria-hidden className="flex">
              {[1, 2, 3, 4, 5].map((index) => (
                <Star key={index} className="size-[12px] text-text-muted" />
              ))}
            </span>
            <span className="text-text-muted">(no reviews yet)</span>
          </p>

          <p className="mt-[10px] line-clamp-3 field-hint">
            {summary || "Your summary appears here as guests will read it."}
          </p>

          <div className="mt-[14px] flex items-end justify-between gap-[10px]">
            <p>
              <span className="text-[20px] font-bold leading-none text-text-primary">
                {formatMoney(perPerson * 100)}
              </span>
              <span className="block field-hint">per person</span>
            </p>
            <span className="hbtn primary small" aria-hidden>Book now</span>
          </div>
        </div>
      </article>

      <p className="mt-[12px] field-hint">
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
