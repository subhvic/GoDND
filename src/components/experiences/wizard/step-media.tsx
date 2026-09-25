"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, ImagePlus, Sparkles, Star, X } from "lucide-react";

import { ImageUploader } from "@/components/experiences/wizard/image-uploader";
import { StepShell } from "@/components/experiences/wizard/step-shell";
import { StoredImage } from "@/components/experiences/wizard/stored-image";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Field, TextArea } from "@/components/ui/field";
import {
  pickableImages,
  THUMBNAIL_OWNER,
  type PickableImage,
} from "@/lib/experience-wizard/images";
import { REGION_OPTIONS } from "@/lib/experience-wizard/options";
import { mediaSchema, type MediaValues } from "@/lib/experience-wizard/schema";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

const FORM_ID = "step-media";

/** Photos shown inline; the rest open in the "See all" dialog. */
const INLINE_LIMIT = 8;

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
  const [galleryOpen, setGalleryOpen] = useState(false);

  const pickable = pickableImages(draft);
  const pickableIds = pickable.map((image) => image.id).join("|");
  const customId = draft.images.find((image) => image.owner === THUMBNAIL_OWNER)?.id;

  const chooseThumbnail = (id: string) =>
    setValue("thumbnailId", id, { shouldValidate: formState.isSubmitted });

  // A thumbnail whose photo has been removed (here, or from its stop) must
  // not survive as a dangling id: the listing would have no cover.
  useEffect(() => {
    if (thumbnailId && !pickableIds.split("|").includes(thumbnailId)) {
      setValue("thumbnailId", "");
    }
  }, [thumbnailId, pickableIds, setValue]);

  // Uploading a custom thumbnail is a choice in itself — select it.
  const previousCustom = useRef(customId);
  useEffect(() => {
    if (customId && customId !== previousCustom.current) {
      setValue("thumbnailId", customId, { shouldValidate: true });
    }
    previousCustom.current = customId;
  }, [customId, setValue]);

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
          {pickable.length > INLINE_LIMIT ? (
            <button type="button" className="hbtn small" onClick={() => setGalleryOpen(true)}>
              See all {pickable.length} photos →
            </button>
          ) : null}
        </div>
        <p className="mt-[4px] field-hint">
          The cover of your listing on the marketplace. Pick one of the photos
          from your itinerary, or upload one just for this.
        </p>

        {pickable.length === 0 ? (
          <div className="mt-[14px] rounded-md border border-dashed border-border-panel p-[16px]">
            <p className="m-0 text-[12.5px] font-semibold text-text-primary">
              No photos to choose from yet
            </p>
            <p className="m-0 mt-[4px] field-hint">
              Photos you add to itinerary stops appear here. Add a few there,
              or upload a custom thumbnail below.
            </p>
            <Link href="/dashboard/experiences/new/itinerary" className="hbtn small mt-[10px]">
              <ImagePlus aria-hidden />
              Add photos to the itinerary
            </Link>
          </div>
        ) : (
          <ThumbnailOptions
            className="mt-[14px]"
            labelledBy="thumbnail"
            describedBy={errors.thumbnailId ? "thumbnail-error" : undefined}
            options={inlineOptions(pickable, thumbnailId)}
            value={thumbnailId}
            onChange={chooseThumbnail}
          />
        )}

        {errors.thumbnailId ? (
          <p id="thumbnail-error" role="alert" className="mt-[8px] field-error">
            {errors.thumbnailId.message}
          </p>
        ) : null}

        <div className="mt-[18px]">
          <ImageUploader
            owner={THUMBNAIL_OWNER}
            max={1}
            mode="single"
            label="Custom thumbnail"
            hint="Optional. Uploading one selects it as the thumbnail. Shown cropped to 4:3."
          />
        </div>

        <GalleryDialog
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          options={pickable}
          value={thumbnailId}
          onChange={chooseThumbnail}
        />
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
          className={cn(
            "flex h-[160px] items-center justify-center bg-panel text-[12px] text-text-muted",
            !thumbnailId && "border-b border-dashed border-border-panel",
          )}
        >
          {thumbnailId ? (
            <StoredImage id={thumbnailId} variant="full" alt="Thumbnail as guests will see it" />
          ) : (
            "No thumbnail chosen"
          )}
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

/** Keeps the chosen photo visible inline even when it sits past the limit. */
function inlineOptions(options: PickableImage[], value: string) {
  const inline = options.slice(0, INLINE_LIMIT);
  const chosen = options.find((option) => option.id === value);
  if (chosen && !inline.includes(chosen)) inline[inline.length - 1] = chosen;
  return inline;
}

/**
 * Single-choice photo grid. A radiogroup with a roving tab stop: Tab enters
 * and leaves the group in one step, arrows move and select — what a keyboard
 * user expects from a single-choice control, and what a row of buttons with
 * role="radio" alone does not give them.
 */
function ThumbnailOptions({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
  className,
}: {
  options: PickableImage[];
  value: string;
  onChange: (id: string) => void;
  labelledBy: string;
  describedBy?: string;
  className?: string;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const focusIndex = Math.max(0, options.findIndex((option) => option.id === value));

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn("pick-grid", className)}
    >
      {options.map((option, index) => {
        const checked = option.id === value;
        return (
          <button
            key={option.id}
            ref={(node) => {
              if (node) refs.current.set(option.id, node);
              else refs.current.delete(option.id);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${option.alt || option.name}, ${option.source}`}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="pick"
          >
            <span className="pick-media">
              <StoredImage id={option.id} alt="" />
              {checked ? (
                <span className="pick-check" aria-hidden>
                  <Check />
                </span>
              ) : null}
            </span>
            <span className="pick-caption">{option.source}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Every photo, when there are more than fit inline. Native <dialog>: focus
 *  is trapped, Escape closes, and focus returns to the opener — for free. */
function GalleryDialog({
  open,
  onClose,
  options,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  options: PickableImage[];
  value: string;
  onChange: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const chosen = options.find((option) => option.id === value);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="gallery-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="gallery-title" className="dialog-title">
          All photos ({options.length})
        </h2>
        <button type="button" className="record-drawer-close" aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </button>
      </div>
      <div className="dialog-body">
        {open ? (
          <ThumbnailOptions
            labelledBy="gallery-title"
            options={options}
            value={value}
            onChange={onChange}
          />
        ) : null}
      </div>
      <div className="dialog-foot">
        <span className="min-w-0 truncate text-[11.5px] text-text-muted">
          {chosen ? `Thumbnail: ${chosen.source}` : "No thumbnail chosen"}
        </span>
        <button type="button" className="hbtn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
