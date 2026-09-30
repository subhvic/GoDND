"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquare, Star } from "lucide-react";

import { replyToReview } from "@/app/dashboard/insights/reviews/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineSelect } from "@/components/ui/inline-select";
import { PageBar } from "@/components/ui/page-bar";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Badge } from "@/components/ui/status";
import type { ReviewList } from "@/lib/reviews/select";
import { REPLY_MAX, REVIEW_VIEWS, type ReviewRecord } from "@/lib/reviews/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * Every review in one place — the screen Insights' review panel points at.
 *
 * It opens on the reviews still owed a reply, longest wait first, because
 * that is the only part of this page that is work. The rating breakdown
 * above it is the collective picture; the filters below narrow the list
 * without touching it.
 */
export function ReviewsView({ list }: { list: ReviewList }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Replies made in this visit. In a sample workspace nothing is stored, and
  // in a live one this shows the reply the instant it is published rather
  // than after the page has revalidated.
  const [replies, setReplies] = useState<Record<string, { reply: string; repliedAt: string }>>({});

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    // Any change to a filter invalidates the page number.
    next.delete("page");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const justReplied = Object.keys(replies).length;
  const counts = {
    needs_reply: Math.max(0, list.counts.needs_reply - justReplied),
    replied: list.counts.replied + justReplied,
    all: list.counts.all,
  };

  return (
    <>
      <PageBar
        crumbs={[
          { label: "Website" },
          { label: "Insights", href: "/dashboard/insights" },
          { label: "Reviews" },
        ]}
      />

      <div className="surface-card">
        <div className="card-scroll">
          <div className="reviews">
            <Summary list={list} />

            <div className="reviews-filters">
              <PillTabs
                label="Reviews to show"
                active={list.view}
                tabs={REVIEW_VIEWS.map((view) => ({
                  id: view.key,
                  label: view.label,
                  count: counts[view.key],
                  countTone: view.key === "needs_reply" && counts.needs_reply > 0 ? "warning" : undefined,
                  href: hrefWith({ view: view.key === "needs_reply" ? null : view.key }),
                }))}
              />
              <div className="reviews-selects">
                <InlineSelect
                  label="Experience"
                  value={list.experienceId}
                  onChange={(value) => router.push(hrefWith({ experience: value === "all" ? null : value }))}
                  options={[
                    { value: "all", label: "All experiences" },
                    ...list.experiences.map((experience) => ({
                      value: experience.id,
                      label: `${experience.title} (${experience.count})`,
                    })),
                  ]}
                />
                <InlineSelect
                  label="Rating"
                  value={list.rating === null ? "all" : String(list.rating)}
                  onChange={(value) => router.push(hrefWith({ rating: value === "all" ? null : value }))}
                  options={[
                    { value: "all", label: "Any rating" },
                    ...[5, 4, 3, 2, 1].map((rating) => ({
                      value: String(rating),
                      label: `${rating} star${rating === 1 ? "" : "s"}`,
                    })),
                  ]}
                />
              </div>
            </div>

            {list.rows.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={MessageSquare}
                  title={emptyTitle(list)}
                  description={emptyDescription(list)}
                  action={
                    list.view !== "all" || list.experienceId !== "all" || list.rating !== null ? (
                      <Button onClick={() => router.push(pathname + "?view=all")}>Show every review</Button>
                    ) : undefined
                  }
                />
              </Panel>
            ) : (
              <>
                <p className="reviews-count" aria-live="polite">
                  {list.total.toLocaleString("en-IN")} review{list.total === 1 ? "" : "s"}
                  {list.view === "needs_reply" && list.total > 0 ? " — longest wait first" : ""}
                </p>
                <ul className="reviews-list">
                  {list.rows.map((review) => (
                    <li key={review.id}>
                      <ReviewCard
                        review={review}
                        pending={replies[review.id] ?? null}
                        onReplied={(reply, repliedAt) =>
                          setReplies((current) => ({ ...current, [review.id]: { reply, repliedAt } }))
                        }
                      />
                    </li>
                  ))}
                </ul>
                {list.pageCount > 1 ? (
                  <div className="flex justify-end">
                    <Pagination page={list.page} pageCount={list.pageCount} />
                  </div>
                ) : null}
              </>
            )}

            {list.isDemoData ? (
              <p className="m-0 field-hint">
                Sample reviews for a preview workspace. Replies aren’t stored here.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function emptyTitle(list: ReviewList) {
  if (list.counts.all === 0) return "No reviews yet";
  if (list.view === "needs_reply") return "Every review has a reply";
  return "Nothing matches these filters";
}

function emptyDescription(list: ReviewList) {
  if (list.counts.all === 0) {
    return "Reviews appear here once guests write them, a few days after a trip ends.";
  }
  if (list.view === "needs_reply") {
    return "Nothing is waiting on you. Replies show under each review on your listing.";
  }
  return "Try a different rating or experience.";
}

/* --------------------------------------------------------------------------
 * The collective picture
 * ----------------------------------------------------------------------- */

function Summary({ list }: { list: ReviewList }) {
  const { count, average, distribution, scope } = list.summary;
  const most = Math.max(1, ...distribution);

  return (
    <Panel
      title="All reviews"
      hint={scope ? scope : "across every experience"}
      actions={
        list.unansweredTotal > 0 ? (
          <span className="text-[11.5px] text-text-muted">
            <Badge status="warning">{list.unansweredTotal}</Badge> waiting for a reply
          </span>
        ) : null
      }
    >
      <div className="panel-body pt-[4px]">
        {count === 0 ? (
          <p className="m-0 text-[12.5px] text-text-muted">No reviews yet.</p>
        ) : (
          <div className="review-summary">
            <div className="review-score">
              <span className="review-avg">{average?.toFixed(1)}</span>
              <Star aria-hidden className="review-star" />
              <span className="review-was">
                {count.toLocaleString("en-IN")} review{count === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="review-bars" aria-label="Reviews by rating">
              {distribution.map((value, index) => (
                <li key={index}>
                  <span className="review-bar-label">{5 - index} ★</span>
                  <span className="review-meter" aria-hidden>
                    <span style={{ width: `${(value / most) * 100}%` }} />
                  </span>
                  <span className="review-bar-count">
                    {value}
                    <span className="sr-only"> {5 - index}-star reviews</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * One review
 * ----------------------------------------------------------------------- */

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star key={step} aria-hidden className={cn("star", step <= rating && "is-on")} />
      ))}
    </span>
  );
}

function ReviewCard({
  review,
  pending,
  onReplied,
}: {
  review: ReviewRecord;
  pending: { reply: string; repliedAt: string } | null;
  onReplied: (reply: string, repliedAt: string) => void;
}) {
  const reply = pending?.reply ?? review.reply;
  const repliedAt = pending?.repliedAt ?? review.repliedAt;
  // A low rating with nobody answering it is the one thing on this page
  // that is actually urgent.
  const urgent = reply === null && review.rating <= 3;

  return (
    <article className={cn("review-card", urgent && "is-urgent")} aria-label={`${review.rating}-star review by ${review.guestName}`}>
      <div className="review-card-head">
        <Stars rating={review.rating} />
        {review.title ? <h3 className="review-card-title">{review.title}</h3> : null}
        {reply === null ? <Badge status={urgent ? "critical" : "warning"}>Needs a reply</Badge> : null}
      </div>

      {review.body ? <p className="review-card-body">{review.body}</p> : null}

      <p className="review-card-meta">
        <span className="review-card-guest">{review.guestName}</span>
        <span aria-hidden>·</span>
        <span>{review.experienceTitle}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(review.createdAt)}</span>
        {review.bookingRef ? (
          <>
            <span aria-hidden>·</span>
            <span className="review-card-ref">{review.bookingRef}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{review.source === "marketplace" ? "GoDND marketplace" : "Your own site"}</span>
      </p>

      {reply !== null ? (
        <div className="review-reply">
          <p className="review-reply-head">
            Your reply{repliedAt ? ` · ${pending ? "just now" : formatDate(repliedAt)}` : ""}
          </p>
          <p className="review-reply-body">{reply}</p>
        </div>
      ) : (
        <ReplyForm review={review} onReplied={onReplied} />
      )}
    </article>
  );
}

function ReplyForm({
  review,
  onReplied,
}: {
  review: ReviewRecord;
  onReplied: (reply: string, repliedAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="review-card-actions">
        <Button onClick={() => setOpen(true)}>
          <MessageSquare aria-hidden />
          Reply
        </Button>
      </div>
    );
  }

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await replyToReview({ reviewId: review.id, reply: value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onReplied(result.reply, result.repliedAt);
    });

  return (
    <form
      className="review-reply-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`reply-${review.id}`} className="field-label">
        Your reply to {review.guestName}
      </label>
      <textarea
        id={`reply-${review.id}`}
        className="textarea"
        rows={3}
        maxLength={REPLY_MAX}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={`reply-hint-${review.id}${error ? ` reply-error-${review.id}` : ""}`}
        placeholder="Travellers read replies before they book, so answer the review rather than thanking it."
      />
      <p id={`reply-hint-${review.id}`} className="field-hint">
        This is published under the review on your listing. {value.trim().length} / {REPLY_MAX}
      </p>
      {error ? (
        <p id={`reply-error-${review.id}`} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      <div className="review-card-actions">
        <Button
          onClick={() => {
            setOpen(false);
            setValue("");
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || value.trim().length === 0}>
          {pending ? "Publishing…" : "Publish reply"}
        </Button>
      </div>
    </form>
  );
}
