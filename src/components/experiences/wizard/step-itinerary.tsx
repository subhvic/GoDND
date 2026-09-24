"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { ImagePlus, MapPin, Plus, Trash2 } from "lucide-react";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import {
  ACTIVITY_KIND_OPTIONS,
  REGION_OPTIONS,
  STOPPAGE_OPTIONS,
} from "@/lib/experience-wizard/options";
import {
  itinerarySchema,
  type ActivityValues,
  type DayValues,
  type ItineraryValues,
} from "@/lib/experience-wizard/schema";
import { cn } from "@/lib/utils";

const FORM_ID = "step-itinerary";

/**
 * Step 2 of 7 — the itinerary builder.
 *
 * The day count is derived from Basic Info's duration rather than being its own
 * control: the file shows Day 1…5 for a "5 days & 4 nights" experience, and
 * letting the two disagree would produce an itinerary that contradicts the
 * listing. Changing the duration on step 1 adds or removes days here, keeping
 * whatever was already filled in on the days that survive.
 */
export function StepItinerary() {
  const { draft } = useWizard();
  const dayCount = draft.basicInfo.durationDays || 1;

  const { form, handleSubmit, errorSummary } = useStepForm<
    "itinerary",
    ItineraryValues
  >({
    sectionKey: "itinerary",
    slug: "itinerary",
    schema: itinerarySchema,
  });

  const { control, watch, setValue } = form;
  const days = normaliseDays(watch("days"), dayCount);
  const [activeDay, setActiveDay] = useState(1);
  const current = days.find((day) => day.dayNumber === activeDay) ?? days[0];

  const updateDay = (dayNumber: number, patch: Partial<DayValues>) => {
    setValue(
      "days",
      days.map((day) =>
        day.dayNumber === dayNumber ? { ...day, ...patch } : day,
      ),
      { shouldDirty: true },
    );
  };

  const updateActivity = (
    dayNumber: number,
    activityId: string,
    patch: Partial<ActivityValues>,
  ) => {
    const day = days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    updateDay(dayNumber, {
      activities: day.activities.map((activity) =>
        activity.id === activityId ? { ...activity, ...patch } : activity,
      ),
    });
  };

  return (
    <StepShell
      slug="itinerary"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
    >
      {/* Keeps the derived day list inside the form's value, not just local. */}
      <Controller control={control} name="days" render={() => <></>} />

      <div className="flex flex-col gap-[20px] lg:flex-row">
        <nav aria-label="Itinerary days" className="lg:w-[120px] lg:shrink-0">
          <ol className="pill-tabs m-0 w-full list-none lg:flex-col lg:items-stretch">
            {days.map((day) => {
              const isActive = day.dayNumber === activeDay;
              const filled = day.activities.length > 0;
              return (
                <li key={day.dayNumber} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActiveDay(day.dayNumber)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "pill-tab flex w-full items-center justify-between gap-[8px]",
                      isActive && "active",
                    )}
                  >
                    Day {day.dayNumber}
                    {filled && !isActive ? (
                      <span
                        aria-label="has activities"
                        className="size-[6px] rounded-full bg-brand"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-[16px]">
          <section
            aria-labelledby={`pickup-day-${current.dayNumber}`}
            className="rounded-md border border-border-subtle bg-panel p-[14px]"
          >
            <h3
              id={`pickup-day-${current.dayNumber}`}
              className="m-0 flex items-center gap-[6px] text-[12.5px] font-semibold text-text-primary"
            >
              <MapPin aria-hidden className="size-[14px]" />
              Pick-up
            </h3>

            <Checkbox
              className="mt-[12px]"
              label="Not included in the itinerary"
              checked={!current.pickupIncluded}
              onChange={(checked) =>
                updateDay(current.dayNumber, { pickupIncluded: !checked })
              }
            />

            {current.pickupIncluded ? (
              <div className="mt-[14px] grid gap-[14px] md:grid-cols-3">
                <Field label="Location (Pin on Map)" required>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      value={current.pickupLocation}
                      placeholder="Guwahati"
                      onChange={(event) =>
                        updateDay(current.dayNumber, {
                          pickupLocation: event.target.value,
                        })
                      }
                    />
                  )}
                </Field>

                <Field label="Region/State" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={current.pickupRegion}
                      onChange={(event) =>
                        updateDay(current.dayNumber, {
                          pickupRegion: event.target.value,
                        })
                      }
                    >
                      <option value="">Select</option>
                      {REGION_OPTIONS.map((region) => (
                        <option key={region.value} value={region.value}>
                          {region.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Pick-up Time" required>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      type="time"
                      value={current.pickupTime}
                      onChange={(event) =>
                        updateDay(current.dayNumber, {
                          pickupTime: event.target.value,
                        })
                      }
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </section>

          {current.activities.map((activity, index) => (
            <section
              key={activity.id}
              aria-label={`Activity ${index + 1} on day ${current.dayNumber}`}
              className="rounded-md border border-border-panel p-[14px]"
            >
              <div className="flex items-start justify-between gap-[12px] border-b border-border-subtle pb-[12px]">
                <TextInput
                  aria-label="Activity name"
                  value={activity.title}
                  placeholder="Arrive at Umiam Lake Viewpoint"
                  onChange={(event) =>
                    updateActivity(current.dayNumber, activity.id, {
                      title: event.target.value,
                    })
                  }
                  className="border-transparent bg-transparent px-[6px] text-[13px] font-medium focus:bg-panel"
                />
                <button
                  type="button"
                  aria-label={`Remove activity ${index + 1}`}
                  onClick={() =>
                    updateDay(current.dayNumber, {
                      activities: current.activities.filter(
                        (item) => item.id !== activity.id,
                      ),
                    })
                  }
                  className="record-drawer-close hover:text-critical-fg"
                >
                  <Trash2 aria-hidden />
                </button>
              </div>

              <div className="mt-[14px] grid gap-[14px] md:grid-cols-2">
                <Field label="Activity Type" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={activity.kind}
                      onChange={(event) =>
                        updateActivity(current.dayNumber, activity.id, {
                          kind: event.target.value as ActivityValues["kind"],
                        })
                      }
                    >
                      {ACTIVITY_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Stoppage Time" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={activity.stoppageMin ?? ""}
                      onChange={(event) =>
                        updateActivity(current.dayNumber, activity.id, {
                          stoppageMin: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    >
                      <option value="">Select</option>
                      {STOPPAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Pin on Map" required>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      value={activity.locationName}
                      placeholder="Guwahati"
                      onChange={(event) =>
                        updateActivity(current.dayNumber, activity.id, {
                          locationName: event.target.value,
                        })
                      }
                    />
                  )}
                </Field>

                <div>
                  <p className="field-label mb-[6px]">
                    Add Images
                    <span aria-hidden className="req">
                      *
                    </span>
                  </p>
                  <div className="flex items-center gap-[12px]">
                    <button
                      type="button"
                      className="hbtn small"
                    >
                      <ImagePlus aria-hidden />
                      Upload
                    </button>
                    <span className="field-hint">
                      ({activity.imageCount} images)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-[14px]">
                <Field label="Comment">
                  {({ id }) => (
                    <TextArea
                      id={id}
                      value={activity.comment}
                      placeholder="Type here…"
                      onChange={(event) =>
                        updateActivity(current.dayNumber, activity.id, {
                          comment: event.target.value,
                        })
                      }
                    />
                  )}
                </Field>
              </div>
            </section>
          ))}

          <button
            type="button"
            onClick={() =>
              updateDay(current.dayNumber, {
                activities: [
                  ...current.activities,
                  {
                    id: `activity-${Date.now()}`,
                    title: "",
                    kind: "stop_location",
                    stoppageMin: 60,
                    locationName: "",
                    comment: "",
                    imageCount: 0,
                  },
                ],
              })
            }
            className="hbtn brand-lit self-start"
          >
            <Plus aria-hidden />
            Add activity
          </button>
        </div>
      </div>
    </StepShell>
  );
}

/**
 * Reconciles the stored days against the duration chosen on step 1: keeps the
 * days that still exist, adds blanks for new ones, drops the surplus.
 */
function normaliseDays(days: DayValues[], count: number): DayValues[] {
  return Array.from({ length: count }, (_, index) => {
    const dayNumber = index + 1;
    return (
      days.find((day) => day.dayNumber === dayNumber) ?? {
        dayNumber,
        pickupIncluded: dayNumber === 1,
        pickupLocation: "",
        pickupRegion: "",
        pickupTime: "",
        activities: [],
      }
    );
  });
}
