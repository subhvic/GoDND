import type { ExperienceDraft, ImageRef } from "@/lib/experience-wizard/schema";

/** Owner key for photos added to an itinerary stop. */
export const activityOwner = (activityId: string) => `activity:${activityId}`;

/** Owner key for the custom thumbnail uploaded on step 7. */
export const THUMBNAIL_OWNER = "thumbnail";

export type PickableImage = ImageRef & {
  /** Where the photo came from, for captions: "Day 2 · Umiam Lake". */
  source: string;
};

/**
 * Photos that can be the listing thumbnail: every photo on a stop that still
 * exists in the itinerary, in itinerary order, then the custom thumbnail.
 *
 * Photos whose stop has gone (its day was dropped when the duration shrank)
 * are left out rather than offered — choosing one would point the listing at
 * a photo the itinerary no longer shows.
 *
 * One definition shared by step 7 and the review page, so the two can never
 * disagree about whether the chosen thumbnail is valid.
 */
export function pickableImages(draft: ExperienceDraft): PickableImage[] {
  const images = draft.images ?? [];
  const picked: PickableImage[] = [];

  for (const day of draft.itinerary.days) {
    day.activities.forEach((activity, index) => {
      const owner = activityOwner(activity.id);
      for (const image of images.filter((item) => item.owner === owner)) {
        picked.push({
          ...image,
          source: `Day ${day.dayNumber} · ${activity.title || `Stop ${index + 1}`}`,
        });
      }
    });
  }

  for (const image of images.filter((item) => item.owner === THUMBNAIL_OWNER)) {
    picked.push({ ...image, source: "Custom thumbnail" });
  }

  return picked;
}
