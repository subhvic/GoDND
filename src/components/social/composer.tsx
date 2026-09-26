"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";

import { PlatformIcon } from "@/components/social/platform-icon";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/panel";
import { canPublish, countHashtags, firstLine, runChecks } from "@/lib/social/checks";
import {
  ANGLE_HINTS,
  ANGLE_LABELS,
  draftCaption,
  type DraftAngle,
} from "@/lib/social/drafting";
import {
  FORMAT_LABELS,
  PLATFORM_FORMATS,
  PLATFORM_LABELS,
  PLATFORM_RULES,
  SOCIAL_PLATFORMS,
  type PostFormat,
  type SocialPlatform,
} from "@/lib/social/types";
import type { ExperienceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The composer.
 *
 * Its argument is that a travel operator's social content already exists —
 * it is sitting in the experience. Title, regions, duration, group size,
 * price and the next departure are all structured, so the first draft should
 * never start from an empty box. Choosing an experience and an angle produces
 * a caption; the operator edits from there.
 *
 * The checks panel runs on every keystroke and is the part that earns its
 * place before any model does: it is the difference between finding out about
 * a truncated hook now and finding out from the platform tomorrow.
 */
export function Composer({
  experiences,
  connected,
}: {
  experiences: ExperienceRow[];
  connected: SocialPlatform[];
}) {
  const [experienceId, setExperienceId] = useState(experiences[0]?.id ?? "");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(
    connected.length ? [connected[0]] : [],
  );
  const [format, setFormat] = useState<PostFormat>("post");
  const [angle, setAngle] = useState<DraftAngle>("story");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [drafting, startDrafting] = useTransition();

  const experience = experiences.find((item) => item.id === experienceId) ?? null;

  /** Formats every chosen platform accepts — the intersection, not the union. */
  const allowedFormats = useMemo(() => {
    if (platforms.length === 0) return [] as PostFormat[];
    return platforms.reduce<PostFormat[]>(
      (allowed, platform) =>
        allowed.filter((item) => PLATFORM_FORMATS[platform].includes(item)),
      [...PLATFORM_FORMATS[platforms[0]]],
    );
  }, [platforms]);

  const checks = useMemo(
    () =>
      runChecks({
        body,
        format,
        platforms,
        // Photos come from the experience's media library; wiring the picker
        // is the next milestone, so nothing is attached yet.
        imageCount: 0,
        imagesMissingAlt: 0,
        scheduledAt: scheduledAt || null,
      }),
    [body, format, platforms, scheduledAt],
  );

  const ready = canPublish(checks);

  const togglePlatform = (platform: SocialPlatform) => {
    setPlatforms((current) => {
      const next = current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform];
      // Dropping to a format the new selection cannot publish would leave an
      // invalid combination on screen; fall back to the first that works.
      const allowed = next.length
        ? next.reduce<PostFormat[]>(
            (acc, item) => acc.filter((f) => PLATFORM_FORMATS[item].includes(f)),
            [...PLATFORM_FORMATS[next[0]]],
          )
        : [];
      if (allowed.length && !allowed.includes(format)) setFormat(allowed[0]);
      return next;
    });
  };

  const generate = () => {
    if (!experience) return;
    startDrafting(() => {
      setBody(
        draftCaption({
          experience,
          angle,
          platform: platforms[0] ?? "instagram",
          format,
        }),
      );
    });
  };

  if (connected.length === 0) {
    return (
      <Notice status="warning" title="No channel is connected yet">
        A draft with nowhere to publish is just a note. Connect an account on{" "}
        <Link href="/dashboard/social/channels" className="text-brand hover:underline">
          Channels
        </Link>{" "}
        first — it takes a minute, and everything here unlocks.
      </Notice>
    );
  }

  return (
    <div className="composer">
      <div className="flex min-w-0 flex-col gap-[16px]">
        <Panel title="What is this about?">
          <div className="panel-body grid gap-[14px] md:grid-cols-2">
            <Field label="Experience" hint="Its details seed the first draft.">
              {({ id }) => (
                <Select
                  id={id}
                  value={experienceId}
                  onChange={(event) => setExperienceId(event.target.value)}
                >
                  {experiences.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Angle" hint={ANGLE_HINTS[angle]}>
              {({ id }) => (
                <Select
                  id={id}
                  value={angle}
                  onChange={(event) => setAngle(event.target.value as DraftAngle)}
                >
                  {(Object.keys(ANGLE_LABELS) as DraftAngle[]).map((key) => (
                    <option key={key} value={key}>
                      {ANGLE_LABELS[key]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Where does it go?">
          <div className="panel-body flex flex-col gap-[14px]">
            <fieldset className="m-0 border-0 p-0">
              <legend className="field-label mb-[8px] p-0">Channels</legend>
              <div className="flex flex-wrap gap-[8px]">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const available = connected.includes(platform);
                  const active = platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      disabled={!available}
                      aria-pressed={active}
                      title={available ? undefined : `${PLATFORM_LABELS[platform]} is not connected`}
                      onClick={() => togglePlatform(platform)}
                      className={cn("hbtn", active && "brand-lit")}
                    >
                      <PlatformIcon platform={platform} className="size-[14px]" />
                      {PLATFORM_LABELS[platform]}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="field-label mb-[8px] p-0">Format</legend>
              <div className="flex flex-wrap gap-[8px]">
                {allowedFormats.length === 0 ? (
                  <p className="m-0 field-hint">Choose a channel first.</p>
                ) : (
                  allowedFormats.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={format === item}
                      onClick={() => setFormat(item)}
                      className={cn("hbtn", format === item && "brand-lit")}
                    >
                      {FORMAT_LABELS[item]}
                    </button>
                  ))
                )}
              </div>
              {platforms.length > 1 && allowedFormats.length > 0 ? (
                <p className="m-0 mt-[8px] field-hint">
                  Only formats every chosen channel supports are offered.
                </p>
              ) : null}
            </fieldset>
          </div>
        </Panel>

        <Panel
          title="Caption"
          hint={`${body.trim().length} characters · ${countHashtags(body)} hashtags`}
          actions={
            <Button size="small" onClick={generate} disabled={!experience || drafting}>
              <Sparkles aria-hidden />
              {body ? "Redraft" : "Draft for me"}
            </Button>
          }
        >
          <div className="panel-body">
            <label className="sr-only" htmlFor="composer-body">
              Caption
            </label>
            <textarea
              id="composer-body"
              className="compose-box"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                experience
                  ? `Write the caption, or press "Draft for me" to start from ${experience.title}.`
                  : "Write the caption."
              }
            />
            <p className="m-0 mt-[8px] field-hint">
              Drafts are built from this experience&rsquo;s own details. Read
              them before publishing — they are a starting point, not a
              finished post.
            </p>
          </div>
        </Panel>

        <Panel title="When?">
          <div className="panel-body flex flex-wrap items-end gap-[12px]">
            <Field label="Publish at" className="min-w-[220px]">
              {({ id }) => (
                <input
                  id={id}
                  type="datetime-local"
                  className="input"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-[8px]">
              <button type="button" disabled className={buttonClass()}>
                <Save aria-hidden />
                Save draft
              </button>
              <button
                type="button"
                disabled={!ready}
                title={ready ? undefined : "Fix the blocking checks first"}
                className={buttonClass({ variant: "primary" })}
              >
                <CalendarClock aria-hidden />
                {scheduledAt ? "Schedule" : "Publish now"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <aside className="flex min-w-0 flex-col gap-[16px]">
        <Panel
          title="Checks"
          hint={ready ? "nothing blocking" : "must fix before publishing"}
        >
          <div className="panel-body">
            <ul className="check-list">
              {checks.length === 0 ? (
                <li className="check healthy">
                  <CheckCircle2 aria-hidden />
                  <span>Ready to publish.</span>
                </li>
              ) : (
                checks.map((check) => {
                  const Icon =
                    check.severity === "critical"
                      ? XCircle
                      : check.severity === "warning"
                        ? AlertTriangle
                        : Info;
                  return (
                    <li key={check.id} className={cn("check", check.severity)}>
                      <Icon aria-hidden />
                      <span>
                        {check.platform ? (
                          <strong className="font-semibold">
                            {PLATFORM_LABELS[check.platform]}:{" "}
                          </strong>
                        ) : null}
                        {check.message}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </Panel>

        {platforms.map((platform) => (
          <Preview key={platform} platform={platform} format={format} body={body} />
        ))}
      </aside>
    </div>
  );
}

/** The caption as the platform will actually render it, truncation included. */
function Preview({
  platform,
  format,
  body,
}: {
  platform: SocialPlatform;
  format: PostFormat;
  body: string;
}) {
  const rules = PLATFORM_RULES[platform];
  const aspect = rules.aspect[format] ?? 1;
  const truncates = rules.captionIdeal < rules.captionMax && body.length > rules.captionIdeal;

  return (
    <div className="preview-card">
      <div className="preview-head">
        <PlatformIcon platform={platform} />
        <span className="text-[11.5px] font-semibold text-text-primary">
          {PLATFORM_LABELS[platform]} {FORMAT_LABELS[format].toLowerCase()}
        </span>
      </div>
      <div className="preview-media" style={{ aspectRatio: String(aspect) }}>
        No photo attached
      </div>
      <div className="preview-body">
        {body.trim() ? (
          <>
            {firstLine(body, truncates ? rules.captionIdeal : body.length)}
            {truncates ? <span className="preview-more"> more</span> : null}
          </>
        ) : (
          <span className="text-text-muted">Your caption appears here.</span>
        )}
      </div>
    </div>
  );
}
