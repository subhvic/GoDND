import {
  PLATFORM_LABELS,
  PLATFORM_RULES,
  type PostFormat,
  type SocialPlatform,
} from "@/lib/social/types";

/**
 * Pre-publish quality checks.
 *
 * Every rule here is deterministic and runs in the browser as the operator
 * types. That matters more than it sounds: the alternative is finding out
 * from the platform, hours later, that a caption was truncated mid-sentence
 * or that a reel was rejected for its aspect ratio. None of this needs a
 * model — it needs the platform's own published limits, applied at the moment
 * the text is being written.
 *
 * AI suggestions sit on top of this, not instead of it. A model can propose a
 * better hook; only a rule can promise the caption will not be cut in half.
 */

export type CheckSeverity = "critical" | "warning" | "info";

export type QualityCheck = {
  id: string;
  severity: CheckSeverity;
  /** What is wrong, in the operator's terms. */
  message: string;
  /** Which platform it applies to; null when it applies to all of them. */
  platform: SocialPlatform | null;
};

export type CheckInput = {
  body: string;
  format: PostFormat;
  platforms: SocialPlatform[];
  imageCount: number;
  /** Photos that still have no description, for the accessibility check. */
  imagesMissingAlt: number;
  scheduledAt: string | null;
};

const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const URL = /https?:\/\/\S+/gi;

export const countHashtags = (body: string) => (body.match(HASHTAG) ?? []).length;

/** What Instagram shows before the "more" link: the part that decides the read. */
export const firstLine = (body: string, limit: number) =>
  body.length <= limit ? body : `${body.slice(0, limit).trimEnd()}…`;

export function runChecks(input: CheckInput): QualityCheck[] {
  const { body, format, platforms, imageCount, imagesMissingAlt, scheduledAt } = input;
  const checks: QualityCheck[] = [];
  const trimmed = body.trim();
  const hashtags = countHashtags(body);
  const hasLink = URL.test(body);
  URL.lastIndex = 0;

  if (trimmed.length === 0) {
    checks.push({
      id: "empty",
      severity: "critical",
      message: "The caption is empty.",
      platform: null,
    });
  }

  if (platforms.length === 0) {
    checks.push({
      id: "no-platform",
      severity: "critical",
      message: "Choose at least one channel to publish to.",
      platform: null,
    });
  }

  // Formats that are nothing but their media.
  if (imageCount === 0 && (format === "story" || format === "reel" || format === "carousel")) {
    checks.push({
      id: "media-required",
      severity: "critical",
      message: `A ${format} needs at least one photo.`,
      platform: null,
    });
  }

  if (format === "carousel" && imageCount === 1) {
    checks.push({
      id: "carousel-single",
      severity: "warning",
      message: "A carousel with one photo posts as a plain post. Add another, or switch format.",
      platform: null,
    });
  }

  if (imagesMissingAlt > 0) {
    checks.push({
      id: "alt-text",
      severity: "warning",
      message: `${imagesMissingAlt} photo${imagesMissingAlt === 1 ? "" : "s"} still ${imagesMissingAlt === 1 ? "has" : "have"} no description. Screen readers and search both use it.`,
      platform: null,
    });
  }

  for (const platform of platforms) {
    const rules = PLATFORM_RULES[platform];
    const name = PLATFORM_LABELS[platform];

    if (trimmed.length > rules.captionMax) {
      checks.push({
        id: `too-long-${platform}`,
        severity: "critical",
        message: `${trimmed.length} characters is over ${name}'s ${rules.captionMax} limit — it will be rejected.`,
        platform,
      });
    } else if (rules.captionIdeal < rules.captionMax && trimmed.length > rules.captionIdeal) {
      checks.push({
        id: `truncated-${platform}`,
        severity: "info",
        message: `${name} shows the first ${rules.captionIdeal} characters before "more". Put the hook there.`,
        platform,
      });
    }

    if (hashtags > rules.hashtagMax) {
      checks.push({
        id: `hashtags-max-${platform}`,
        severity: "critical",
        message: `${hashtags} hashtags is over ${name}'s limit of ${rules.hashtagMax}.`,
        platform,
      });
    } else if (hashtags > rules.hashtagIdeal * 2) {
      checks.push({
        id: `hashtags-many-${platform}`,
        severity: "info",
        message: `${hashtags} hashtags on ${name}. Around ${rules.hashtagIdeal} reads less like spam.`,
        platform,
      });
    }

    if (hasLink && !rules.linksClickable) {
      checks.push({
        id: `dead-link-${platform}`,
        severity: "warning",
        message: `Links in an ${name} caption are not clickable. Send people to the link in your bio instead.`,
        platform,
      });
    }

    if (!PLATFORM_RULES[platform].aspect[format]) {
      checks.push({
        id: `format-${platform}`,
        severity: "critical",
        message: `${name} does not support a ${format}.`,
        platform,
      });
    }
  }

  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isFinite(when.getTime()) && when.getTime() < Date.now()) {
      checks.push({
        id: "past",
        severity: "critical",
        message: "That time has passed. Pick a time in the future.",
        platform: null,
      });
    }
  }

  return checks;
}

/** True when nothing blocks publishing; warnings and notes do not block. */
export const canPublish = (checks: QualityCheck[]) =>
  !checks.some((check) => check.severity === "critical");
