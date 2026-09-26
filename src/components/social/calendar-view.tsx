"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { PlatformIcon } from "@/components/social/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PillTabs } from "@/components/ui/pill-tabs";
import {
  RecordDrawer,
  RecordField,
  RecordSection,
} from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status";
import { statusForPost } from "@/lib/status";
import {
  FORMAT_LABELS,
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialPost,
} from "@/lib/social/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * The publishing calendar.
 *
 * A month grid rather than a list because the question an operator brings here
 * is about shape, not order: "is next week empty?", "am I posting three reels
 * on the same day?". A list answers neither at a glance.
 *
 * Drafts have no date, so they cannot sit in the grid. They get their own
 * shelf underneath rather than being hidden — an unscheduled draft is the
 * thing most likely to be forgotten, and the calendar is where someone
 * notices.
 */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Filter = "all" | SocialPlatform;

export function CalendarView({ posts }: { posts: SocialPost[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      filter === "all"
        ? posts
        : posts.filter((post) => post.platforms.includes(filter)),
    [posts, filter],
  );

  const cursor = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + monthOffset);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [monthOffset]);

  const days = useMemo(() => buildMonth(cursor), [cursor]);

  const scheduled = visible.filter((post) => post.scheduledAt ?? post.publishedAt);
  const drafts = visible.filter((post) => post.status === "draft");
  const failed = visible.filter((post) => post.status === "failed");

  const byDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of scheduled) {
      const key = dayKey(new Date(post.scheduledAt ?? post.publishedAt!));
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduledAt ?? a.publishedAt!).getTime() -
          new Date(b.scheduledAt ?? b.publishedAt!).getTime(),
      );
    }
    return map;
  }, [scheduled]);

  const open = posts.find((post) => post.id === openId) ?? null;
  const todayKey = dayKey(new Date());
  const monthLabel = cursor.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const inMonth = days.filter(
    (day) => day.getMonth() === cursor.getMonth() && byDay.has(dayKey(day)),
  ).length;

  return (
    <>
      {failed.length > 0 ? (
        <Notice
          status="critical"
          title={`${failed.length} post${failed.length === 1 ? "" : "s"} failed to publish`}
          className="mb-[14px]"
        >
          {failed[0].failureReason}
        </Notice>
      ) : null}

      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
        <PillTabs
          label="Channel"
          active={filter}
          onChange={(id) => setFilter(id as Filter)}
          tabs={[
            { id: "all", label: "All channels", count: posts.length },
            ...SOCIAL_PLATFORMS.map((platform) => ({
              id: platform,
              label: PLATFORM_LABELS[platform],
              count: posts.filter((post) => post.platforms.includes(platform)).length,
              icon: <PlatformIcon platform={platform} className="size-[13px]" />,
            })),
          ]}
        />

        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            className={buttonClass({ size: "icon" })}
            aria-label="Previous month"
            onClick={() => setMonthOffset((value) => value - 1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <span className="min-w-[132px] text-center text-[12.5px] font-semibold text-text-primary">
            {monthLabel}
          </span>
          <button
            type="button"
            className={buttonClass({ size: "icon" })}
            aria-label="Next month"
            onClick={() => setMonthOffset((value) => value + 1)}
          >
            <ChevronRight aria-hidden />
          </button>
          {monthOffset !== 0 ? (
            <button
              type="button"
              className={buttonClass({ size: "small" })}
              onClick={() => setMonthOffset(0)}
            >
              Today
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="cal-grid min-w-[700px]" role="grid" aria-label={`Posts in ${monthLabel}`}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="cal-head" role="columnheader">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const dayPosts = byDay.get(key) ?? [];
            const outside = day.getMonth() !== cursor.getMonth();
            return (
              <div
                key={key}
                role="gridcell"
                className={cn("cal-cell", outside && "outside", key === todayKey && "today")}
              >
                <span className="cal-date">
                  {day.getDate()}
                  {key === todayKey ? <span className="sr-only"> (today)</span> : null}
                </span>
                {dayPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setOpenId(post.id)}
                    className={cn("cal-chip", statusForPost(post.status))}
                  >
                    <span className="cal-chip-time">
                      {new Date(post.scheduledAt ?? post.publishedAt!).toLocaleTimeString(
                        "en-IN",
                        { hour: "numeric", minute: "2-digit" },
                      )}
                    </span>
                    <PlatformIcon platform={post.platforms[0]} className="size-[11px] shrink-0" />
                    <span className="cal-chip-name">{post.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {inMonth === 0 ? (
        <div className="mt-[14px]">
          <EmptyState
            icon={CalendarRange}
            title={`Nothing planned in ${monthLabel}`}
            description="A month with no posts is a month the departures have to fill on their own."
            action={
              <Link href="/dashboard/social/studio" className={buttonClass({ variant: "primary" })}>
                Draft a post
              </Link>
            }
          />
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <section className="mt-[18px]" aria-labelledby="drafts">
          <h2 id="drafts" className="m-0 text-[13px] font-semibold text-text-primary">
            Drafts
            <span className="ml-[6px] text-[11.5px] font-normal text-text-muted">
              not scheduled — they will not go out
            </span>
          </h2>
          <ul className="mt-[10px] flex flex-wrap gap-[8px] p-0">
            {drafts.map((post) => (
              <li key={post.id} className="list-none">
                <button
                  type="button"
                  onClick={() => setOpenId(post.id)}
                  className={cn("cal-chip", "neutral", "w-auto")}
                >
                  <PlatformIcon platform={post.platforms[0]} className="size-[11px] shrink-0" />
                  <span className="cal-chip-name">{post.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open ? <PostDrawer post={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function PostDrawer({ post, onClose }: { post: SocialPost; onClose: () => void }) {
  const status = statusForPost(post.status);
  const when = post.scheduledAt ?? post.publishedAt;

  return (
    <RecordDrawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={post.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
          <StatusBadge status={status} label={POST_STATUS_LABELS[post.status]} />
          <span>{FORMAT_LABELS[post.format]}</span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>{post.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
        </span>
      }
      actions={
        <Link href="/dashboard/social/studio" className={buttonClass()}>
          Edit in Studio
        </Link>
      }
    >
      {post.status === "failed" && post.failureReason ? (
        <div className="p-[16px] pb-0">
          <Notice status="critical" title="This post did not go out">
            {post.failureReason}
          </Notice>
        </div>
      ) : null}

      <RecordSection title="Caption">
        <div className="whitespace-pre-wrap px-[16px] pb-[14px] text-[12.5px] leading-[1.6] text-text-primary">
          {post.body}
        </div>
      </RecordSection>

      <RecordSection title="Details">
        <RecordField label={post.publishedAt ? "Published" : "Scheduled"}>
          {when
            ? `${formatDate(when)} · ${new Date(when).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })}`
            : "Not scheduled"}
        </RecordField>
        <RecordField label="Experience">
          {post.experienceTitle ?? "Not linked to an experience"}
        </RecordField>
        <RecordField label="Photos">
          {post.imageIds.length || "None attached"}
        </RecordField>
      </RecordSection>

      {post.metrics ? (
        <RecordSection title="Performance">
          <RecordField label="Reach">
            {post.metrics.reach.toLocaleString("en-IN")}
          </RecordField>
          <RecordField label="Likes">
            {post.metrics.likes.toLocaleString("en-IN")}
          </RecordField>
          <RecordField label="Comments">
            {post.metrics.comments.toLocaleString("en-IN")}
          </RecordField>
          <RecordField label="Saves">
            {post.metrics.saves.toLocaleString("en-IN")}
          </RecordField>
          <RecordField label="Link clicks">
            {post.metrics.linkClicks.toLocaleString("en-IN")}
          </RecordField>
        </RecordSection>
      ) : null}
    </RecordDrawer>
  );
}

/* -------------------------------------------------------------------------- */

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Six Monday-first weeks covering the month, so the grid never reflows. */
function buildMonth(cursor: Date): Date[] {
  const first = new Date(cursor);
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
