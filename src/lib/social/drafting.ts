import type { ExperienceRow } from "@/lib/types";
import type { PostFormat, SocialPlatform } from "@/lib/social/types";
import { formatMoney } from "@/lib/utils";

/**
 * Caption drafting from an experience.
 *
 * This is a template engine, not a model, and it is deliberately the first
 * version. Two reasons:
 *
 *   1. It proves the input. Every angle below is built only from fields the
 *      experience already has — title, regions, duration, group size, price,
 *      next departure. If a template can produce a usable caption from them,
 *      a model given the same fields plus the itinerary will do better. If it
 *      cannot, no model call was going to fix the missing data.
 *   2. It is the fallback. An operator drafting a post on a hill connection
 *      when the model call times out still needs a starting caption, and
 *      "try again later" is not one.
 *
 * The server action that replaces this keeps the same signature, so the
 * composer does not change when the model lands: same inputs, same shape
 * back, and this stays behind it as the degraded path.
 */

export type DraftAngle = "story" | "proof" | "urgency";

export const ANGLE_LABELS: Record<DraftAngle, string> = {
  story: "Story",
  proof: "What makes it different",
  urgency: "Seats and dates",
};

export const ANGLE_HINTS: Record<DraftAngle, string> = {
  story: "Opens on a detail, not the offer. Best for reach.",
  proof: "Leads with the thing competitors cannot copy.",
  urgency: "Names the departure and what is left. Best for clicks.",
};

const hashtagify = (value: string) =>
  `#${value.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

function tags(experience: ExperienceRow, limit: number): string {
  const base = [
    ...experience.location.map(hashtagify),
    "#northeastindia",
    "#slowtravel",
  ];
  return [...new Set(base)].slice(0, limit).join(" ");
}

const where = (experience: ExperienceRow) =>
  experience.location[0] ?? "the Northeast";

/**
 * @param platform decides length and hashtag budget — the same angle reads
 *   differently at 280 characters than at 2,200.
 */
export function draftCaption({
  experience,
  angle,
  platform,
  format,
}: {
  experience: ExperienceRow;
  angle: DraftAngle;
  platform: SocialPlatform;
  format: PostFormat;
}): string {
  const place = where(experience);
  const nights = experience.durationNights ?? 0;
  const days = experience.durationDays ?? 0;
  const span = days ? `${days} days` : "A few days";
  const price = experience.basePriceMinor
    ? formatMoney(experience.basePriceMinor, experience.currency)
    : null;
  const seats = experience.groupSize;
  const departs = experience.nextAvailableOn
    ? new Date(experience.nextAvailableOn).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
      })
    : null;

  const terse = platform === "x";
  const tagCount = terse ? 2 : 5;

  if (angle === "story") {
    const hook =
      format === "reel" || format === "story"
        ? `Most people see ${place} from a car window.`
        : `There is a version of ${place} that does not make the itineraries.`;
    if (terse) {
      return `${hook}\n\n${span}, ${seats ? `${seats} of us` : "a small group"}, and the parts you can only reach on foot.\n\n${tags(experience, tagCount)}`;
    }
    return `${hook}\n\n${experience.title} is ${span}${nights ? ` and ${nights} nights` : ""} spent where the road stops — walking, eating and sleeping in places that took us years to be welcome in.\n\n${seats ? `We cap it at ${seats}, because that is what a single homestay can feed at one sitting.` : "We keep the group small on purpose."}\n\nFull itinerary in bio.\n\n${tags(experience, tagCount)}`;
  }

  if (angle === "proof") {
    const lead = `What ${experience.title} has that a cheaper version does not:`;
    if (terse) {
      return `${lead}\n\n${seats ? `Groups of ${seats}. ` : ""}Local guides who live there. ${span} that actually stop.\n\n${tags(experience, tagCount)}`;
    }
    return `${lead}\n\n· ${seats ? `A group of ${seats}` : "A small group"}, not a bus\n· Guides from ${place}, not from a city agency\n· ${span}${nights ? `, ${nights} nights` : ""} — no pre-dawn transfers to make the schedule work\n${price ? `· ${price} per person, with nothing added at the end\n` : ""}\nThe difference is not the sights. It is how long you get to stand in front of them.\n\n${tags(experience, tagCount)}`;
  }

  const opener = departs
    ? `${experience.title} departs ${departs}.`
    : `${experience.title} is open for booking.`;
  if (terse) {
    return `${opener}${seats ? ` ${seats} seats.` : ""}${price ? ` ${price} pp.` : ""}\n\nLink in bio.\n\n${tags(experience, tagCount)}`;
  }
  return `${opener}\n\n${span}${nights ? ` and ${nights} nights` : ""} across ${experience.location.join(" and ") || place}${seats ? `, capped at ${seats} people` : ""}${price ? `, from ${price} per person` : ""}.\n\nWhen it is full, the next one is not until the season turns.\n\nBooking link in bio.\n\n${tags(experience, tagCount)}`;
}
