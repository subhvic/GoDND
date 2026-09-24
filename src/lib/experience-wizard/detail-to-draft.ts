import type { ExperienceDetail, ExperienceKind } from "@/lib/types";
import {
  ACTIVITY_OPTIONS,
  CATEGORY_OPTIONS,
  CREW_OPTIONS,
  REGION_OPTIONS,
} from "@/lib/experience-wizard/options";
import { emptyDraft, type ExperienceDraft } from "@/lib/experience-wizard/schema";

/*
 * Turn the row-level detail the drawer already loads into a wizard draft the
 * seven steps can edit.
 *
 * The detail carries labels ("Adventure"), the draft carries values
 * ("adventure"), so option lists are looked up by loose match. Anything the
 * detail does not carry (individual day activities, availability windows,
 * inclusions, policies) falls back to the schema's `emptyDraft` — the
 * operator sees exactly what's saved on the row and defaults for what isn't,
 * and every "empty" field is a real prompt to fill in rather than a lie about
 * what the row actually holds.
 */

/** Reverse-lookup: label → value on an options list. Case-insensitive. */
function toValue(
  options: readonly { value: string; label: string }[],
  label: string,
): string | undefined {
  const needle = label.trim().toLowerCase();
  return options.find((option) => option.label.toLowerCase() === needle)?.value;
}

function toValues(
  options: readonly { value: string; label: string }[],
  labels: string[] | null | undefined,
): string[] {
  if (!labels) return [];
  const seen = new Set<string>();
  for (const label of labels) {
    const value = toValue(options, label);
    if (value) seen.add(value);
  }
  return Array.from(seen);
}

/** Normalise the row's kind to what the wizard's basic-info schema accepts. */
function normaliseKind(kind: ExperienceKind): ExperienceDraft["basicInfo"]["kind"] {
  // general_joinee is a display distinction on the list; from the wizard's
  // perspective it is still a general experience.
  return kind === "general_joinee" ? "general" : kind;
}

/** Reduce a "Breakfast & Dinner" style label to the schema's enum. */
function normaliseFoodIncluded(
  label: string | null,
): ExperienceDraft["basicInfo"]["foodIncluded"] {
  if (!label) return "none";
  const lower = label.toLowerCase();
  if (lower.includes("lunch")) return "breakfast_lunch_dinner";
  if (lower.includes("breakfast") || lower.includes("dinner"))
    return "breakfast_dinner";
  return "none";
}

/** Same idea for the food-preference enum. */
function normaliseFoodPreference(
  label: string | null,
): ExperienceDraft["basicInfo"]["foodPreference"] {
  if (!label) return "both";
  const lower = label.toLowerCase();
  if (lower.includes("non-veg") && lower.includes("veg")) return "both";
  if (lower.includes("non-veg")) return "non_veg_only";
  if (lower.includes("veg")) return "veg_only";
  return "both";
}

export function detailToDraft(detail: ExperienceDetail): ExperienceDraft {
  const kind = normaliseKind(detail.kind);
  const regions = toValues(REGION_OPTIONS, detail.location);
  const categories = toValues(CATEGORY_OPTIONS, detail.categories);
  const activityTags = toValues(ACTIVITY_OPTIONS, detail.activityTags);

  // The row keeps one price; the wizard splits it across "per guest" and a
  // variable table. Copy the base amount either way and let the operator
  // add tiers if the row was variable.
  const basePrice = detail.basePriceMinor != null ? detail.basePriceMinor / 100 : 0;

  return {
    ...emptyDraft,
    basicInfo: {
      kind,
      title: detail.title,
      regions: regions.length ? regions : emptyDraft.basicInfo.regions,
      durationDays:
        detail.durationDays ?? emptyDraft.basicInfo.durationDays,
      durationNights:
        detail.durationNights ?? emptyDraft.basicInfo.durationNights,
      categories: categories.length ? categories : emptyDraft.basicInfo.categories,
      languages: emptyDraft.basicInfo.languages,
      minAge: emptyDraft.basicInfo.minAge,
      maxAge: emptyDraft.basicInfo.maxAge,
      activityTags: activityTags.length
        ? activityTags
        : emptyDraft.basicInfo.activityTags,
      foodIncluded: normaliseFoodIncluded(detail.foodIncluded),
      foodPreference: normaliseFoodPreference(detail.foodPreference),
    },
    itinerary: {
      // Day 1 keeps whatever pick-up the row already stored; the rest of the
      // itinerary comes from the wizard's defaults, so the operator sees empty
      // days waiting to be filled rather than fake activities.
      days: [
        {
          dayNumber: 1,
          pickupIncluded: Boolean(detail.pickupLocation),
          pickupLocation: detail.pickupLocation ?? "",
          pickupRegion: "",
          pickupTime: "",
          activities: [],
        },
      ],
    },
    crew: {
      ...emptyDraft.crew,
      tripCaptain:
        toValue(CREW_OPTIONS, detail.tripCaptain ?? "") ?? emptyDraft.crew.tripCaptain,
      maxGroupSize: detail.groupSize ?? emptyDraft.crew.maxGroupSize,
    },
    pricing: {
      ...emptyDraft.pricing,
      basePrice,
      maxGuestsPerBooking:
        detail.groupSize ?? emptyDraft.pricing.maxGuestsPerBooking,
      pricingMode: detail.variablePricing ? "variable" : "unit_multiply",
    },
    availability: {
      ...emptyDraft.availability,
      // One placeholder window ending on the row's inventory-until date, so
      // the operator sees the current bookable window rather than a blank
      // form. `from` is left blank because the row doesn't carry it.
      logs: [
        {
          id: "log-existing",
          from: "",
          to: detail.inventoryUntil ?? "",
        },
      ],
    },
  };
}
