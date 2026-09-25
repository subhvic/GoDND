import { z } from "zod";

/**
 * Validation for the 7-step Add New Experience wizard.
 *
 * Two rules shape every schema here:
 *
 * 1. "Save as Draft" is available on every step, so nothing is required at the
 *    storage layer. Each step schema validates only what that step asks for,
 *    and only when the operator moves forward.
 * 2. Required fields are exactly the ones the handoff file marks with a red
 *    asterisk. Anything not marked is optional, however tempting it is to
 *    insist on it.
 */

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

const requiredList = (label: string) =>
  z.array(z.string()).min(1, `Select at least one ${label}`);

/* --- Step 1: Basic Info --------------------------------------------------- */

export const experienceKindSchema = z.enum(["general", "quick", "super"]);
export const foodIncludedSchema = z.enum([
  "none",
  "breakfast_dinner",
  "breakfast_lunch_dinner",
]);
export const foodPreferenceSchema = z.enum(["veg_only", "non_veg_only", "both"]);

export const basicInfoSchema = z.object({
  kind: experienceKindSchema,
  title: requiredText("Experience name"),
  regions: requiredList("region"),
  durationDays: z.coerce.number().int().min(1).max(90),
  durationNights: z.coerce.number().int().min(0).max(89),
  categories: requiredList("category"),
  languages: requiredList("language"),
  minAge: z.coerce.number().int().min(0).max(99),
  maxAge: z.coerce.number().int().min(0).max(120),
  activityTags: requiredList("activity tag"),
  foodIncluded: foodIncludedSchema,
  foodPreference: foodPreferenceSchema,
});

/* --- Step 2: Itinerary Builder -------------------------------------------- */

export const activitySchema = z.object({
  id: z.string(),
  title: requiredText("Activity name"),
  kind: z.enum([
    "stop_location",
    "stay",
    "meal",
    "transfer",
    "trek",
    "activity",
    "free_time",
  ]),
  stoppageMin: z.coerce.number().int().min(0).nullable(),
  locationName: z.string().trim().default(""),
  comment: z.string().trim().default(""),
});

export const daySchema = z.object({
  dayNumber: z.number().int().min(1),
  pickupIncluded: z.boolean(),
  pickupLocation: z.string().trim().default(""),
  pickupRegion: z.string().trim().default(""),
  pickupTime: z.string().trim().default(""),
  activities: z.array(activitySchema),
});

export const itinerarySchema = z.object({
  days: z.array(daySchema).min(1),
});

/* --- Step 3: Crew & Trip Capacity ----------------------------------------- */

export const crewSchema = z.object({
  tripCaptain: requiredText("Trip Captain"),
  coordinator: requiredText("Trip Co-ordinator"),
  hasGroundCrew: z.boolean(),
  crewMembers: z.array(z.string()),
  onboardingStrategy: z.enum(["open", "invite_only", "request_to_join"]),
  maxGroupSize: z.coerce.number().int().min(1).max(200),
});

/* --- Step 4: Pricing Strategy --------------------------------------------- */

export const pricingSchema = z
  .object({
    basePrice: z.coerce.number().min(0, "Base price is required"),
    maxGuestsPerBooking: z.coerce.number().int().min(1).max(50),
    pricingMode: z.enum(["unit_multiply", "variable"]),
    /**
     * Guest count -> total for the group, as confirmed with the product owner:
     * "2 Guests — ₹13,500" is the pair's total, not a per-head rate.
     */
    tiers: z.record(z.string(), z.coerce.number().min(0)),
    couponCode: z.string().trim().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.pricingMode !== "variable") return;

    // Variable pricing must cover every group size from 2 up to the maximum,
    // otherwise a guest picking an uncovered count sees no price at all.
    for (let count = 2; count <= value.maxGuestsPerBooking; count += 1) {
      const tier = value.tiers[String(count)];
      if (tier == null || Number.isNaN(tier) || tier <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tiers", String(count)],
          message: `Set a price for ${count} guests`,
        });
      }
    }
  });

/* --- Step 5: Availability Calendar ---------------------------------------- */

const dateRangeSchema = z
  .object({
    id: z.string(),
    from: z.string().trim(),
    to: z.string().trim(),
  })
  .refine((range) => !range.from || !range.to || range.to >= range.from, {
    message: "End date must be on or after the start date",
    path: ["to"],
  });

export const availabilitySchema = z.object({
  availabilityMode: z.enum(["selective", "always", "on_request"]),
  logs: z
    .array(dateRangeSchema)
    .min(1)
    .refine(
      (logs) => logs.every((log) => log.from && log.to),
      "Complete every availability window, or remove the empty one",
    ),
  blockAfterFullCapacity: z.boolean(),
  blockForDays: z.coerce.number().int().min(0).max(90),
  holidays: z.array(dateRangeSchema),
});

/* --- Step 6: Support & Policies ------------------------------------------- */

export const policiesSchema = z.object({
  inclusions: requiredList("inclusion"),
  exclusions: requiredList("exclusion"),
  departureNote: requiredText("First point of contact"),
  accessibility: z.array(z.string()),
  additionalInfo: z.array(z.string()),
  acceptCancellationPolicy: z.literal(true, {
    message: "Accept the cancellation policy to continue",
  }),
  acceptSupportStandards: z.literal(true, {
    message: "Accept the customer support standards to continue",
  }),
});

/* --- Step 7: Media & Overview --------------------------------------------- */

export const mediaSchema = z.object({
  thumbnailId: z.string().trim().min(1, "Choose a thumbnail image"),
  summary: requiredText("Experience summary").max(
    600,
    "Keep the summary under 600 characters",
  ),
});

/* --- Photos --------------------------------------------------------------- */

/**
 * A photo's record in the draft. The pixels are not here: they live in the
 * browser's IndexedDB (see image-db.ts), because a draft in sessionStorage has
 * a ~5 MB ceiling and a single phone photo can exceed it. The draft carries
 * only what the UI and the server need to reason about the photo.
 *
 * `owner` says where the photo was added: `activity:<activityId>` for an
 * itinerary stop, or `thumbnail` for a custom thumbnail from step 7.
 */
export const imageRefSchema = z.object({
  id: z.string(),
  owner: z.string(),
  name: z.string(),
  alt: z.string().default(""),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Size after optimisation — what would be uploaded. */
  bytes: z.number().int().nonnegative(),
  originalBytes: z.number().int().nonnegative(),
});

/* --- The whole draft ------------------------------------------------------ */

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;
export type ItineraryValues = z.infer<typeof itinerarySchema>;
export type CrewValues = z.infer<typeof crewSchema>;
export type PricingValues = z.infer<typeof pricingSchema>;
export type AvailabilityValues = z.infer<typeof availabilitySchema>;
export type PoliciesValues = z.infer<typeof policiesSchema>;
export type MediaValues = z.infer<typeof mediaSchema>;
export type DayValues = z.infer<typeof daySchema>;
export type ActivityValues = z.infer<typeof activitySchema>;
export type ImageRef = z.infer<typeof imageRefSchema>;

export type ExperienceDraft = {
  basicInfo: BasicInfoValues;
  itinerary: ItineraryValues;
  crew: CrewValues;
  pricing: PricingValues;
  availability: AvailabilityValues;
  policies: PoliciesValues;
  media: MediaValues;
  /** Every photo in the draft, in display order within each owner. */
  images: ImageRef[];
};

export const emptyDraft: ExperienceDraft = {
  basicInfo: {
    kind: "general",
    title: "",
    regions: [],
    durationDays: 5,
    durationNights: 4,
    categories: [],
    languages: [],
    minAge: 16,
    maxAge: 40,
    activityTags: [],
    foodIncluded: "breakfast_dinner",
    foodPreference: "both",
  },
  itinerary: {
    days: [
      {
        dayNumber: 1,
        pickupIncluded: true,
        pickupLocation: "",
        pickupRegion: "",
        pickupTime: "",
        activities: [],
      },
    ],
  },
  crew: {
    tripCaptain: "",
    coordinator: "",
    hasGroundCrew: false,
    crewMembers: [],
    onboardingStrategy: "open",
    maxGroupSize: 8,
  },
  pricing: {
    basePrice: 0,
    maxGuestsPerBooking: 4,
    pricingMode: "unit_multiply",
    tiers: {},
    couponCode: "",
  },
  availability: {
    availabilityMode: "selective",
    logs: [{ id: "log-1", from: "", to: "" }],
    blockAfterFullCapacity: false,
    blockForDays: 6,
    holidays: [],
  },
  policies: {
    inclusions: [],
    exclusions: [],
    departureNote: "",
    accessibility: [],
    additionalInfo: [],
    acceptCancellationPolicy: false as unknown as true,
    acceptSupportStandards: false as unknown as true,
  },
  media: {
    thumbnailId: "",
    summary: "",
  },
  images: [],
};
