"use client";

import { Plus, Trash2 } from "lucide-react";

import { StepShell } from "@/components/experiences/wizard/step-shell";
import { useStepForm } from "@/components/experiences/wizard/use-step-form";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field";
import {
  availabilitySchema,
  type AvailabilityValues,
} from "@/lib/experience-wizard/schema";
import { cn } from "@/lib/utils";

const FORM_ID = "step-availability";

type Range = AvailabilityValues["logs"][number];

/** Step 5 of 7 — Availability Calendar. */
export function StepAvailability() {
  const { form, handleSubmit, errorSummary } = useStepForm<
    "availability",
    AvailabilityValues
  >({
    sectionKey: "availability",
    slug: "availability",
    schema: availabilitySchema,
  });

  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;

  const logs = watch("logs") ?? [];
  const holidays = watch("holidays") ?? [];
  const blockEnabled = watch("blockAfterFullCapacity");

  const setRanges = (field: "logs" | "holidays", value: Range[]) =>
    setValue(field, value, { shouldDirty: true });

  return (
    <StepShell
      slug="availability"
      formId={FORM_ID}
      errorSummary={errorSummary}
      onSubmit={handleSubmit}
      aside={<AvailabilityPreview logs={logs} holidays={holidays} />}
    >
      <section aria-labelledby="trip-availability">
        <h3
          id="trip-availability"
          className="mb-[14px] text-body font-medium text-neutral-1"
        >
          Trip Availability Setting
        </h3>

        <Field
          label="Pricing for the group based on number of guests"
          required
          error={errors.availabilityMode?.message}
          className="max-w-[420px]"
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              {...register("availabilityMode")}
            >
              <option value="selective">Selective Availability</option>
              <option value="always">Always Available</option>
              <option value="on_request">On Request Only</option>
            </Select>
          )}
        </Field>
      </section>

      <RangeList
        legend="Availability Log"
        ranges={logs}
        error={errors.logs?.message ?? errors.logs?.root?.message}
        addLabel="Add another log"
        onChange={(value) => setRanges("logs", value)}
        idPrefix="log"
        minRanges={1}
      />

      <div className="flex flex-wrap items-center gap-[10px]">
        <Checkbox
          label="Block available status for other bookings for next"
          checked={blockEnabled}
          onChange={(checked) => setValue("blockAfterFullCapacity", checked)}
        />
        <Select
          aria-label="Number of days to block"
          disabled={!blockEnabled}
          className="w-[90px]"
          {...register("blockForDays")}
        >
          {Array.from({ length: 31 }, (_, index) => index).map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </Select>
        <span className="text-small text-neutral-1">
          days once a booking is confirmed at full capacity
        </span>
      </div>

      <section aria-labelledby="mark-holidays" className="mt-[10px]">
        <h3
          id="mark-holidays"
          className="text-body font-medium text-neutral-1"
        >
          Mark Holidays
        </h3>
        <p className="mt-[6px] text-small text-neutral-2">
          ** Availability will be blocked from your available period to avoid
          conflict.
          <br />
          ** You can only add holidays for days that are available.
        </p>

        <RangeList
          className="mt-[14px]"
          legend="Holiday List"
          ranges={holidays}
          addLabel="Add another holiday"
          onChange={(value) => setRanges("holidays", value)}
          idPrefix="holiday"
          minRanges={0}
        />
      </section>
    </StepShell>
  );
}

/**
 * A repeating "Starting from / Till" pair. Used for both availability windows
 * and holidays, which are the same control in the file.
 */
function RangeList({
  legend,
  ranges,
  onChange,
  addLabel,
  idPrefix,
  minRanges,
  error,
  className,
}: {
  legend: string;
  ranges: Range[];
  onChange: (ranges: Range[]) => void;
  addLabel: string;
  idPrefix: string;
  minRanges: number;
  error?: string;
  className?: string;
}) {
  const update = (id: string, patch: Partial<Range>) =>
    onChange(ranges.map((range) => (range.id === id ? { ...range, ...patch } : range)));

  return (
    <fieldset className={className}>
      <legend className="mb-[10px] text-small font-medium text-neutral-1">
        {legend}
      </legend>

      <div className="flex flex-col gap-[12px]">
        {ranges.map((range, index) => (
          <div
            key={range.id}
            className="flex flex-wrap items-end gap-[14px] border border-neutral-4 p-[14px]"
          >
            <Field label="Starting from" required className="min-w-[180px] flex-1">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={range.from}
                  onChange={(event) => update(range.id, { from: event.target.value })}
                />
              )}
            </Field>

            <Field label="Till" required className="min-w-[180px] flex-1">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={range.to}
                  // A window cannot end before it starts; enforced in the
                  // control as well as the schema so the picker itself blocks it.
                  min={range.from || undefined}
                  onChange={(event) => update(range.id, { to: event.target.value })}
                />
              )}
            </Field>

            {ranges.length > minRanges ? (
              <button
                type="button"
                aria-label={`Remove ${legend} entry ${index + 1}`}
                onClick={() =>
                  onChange(ranges.filter((item) => item.id !== range.id))
                }
                className="mb-[10px] p-[6px] text-neutral-2 hover:text-[#d92d20]"
              >
                <Trash2 aria-hidden className="size-[16px]" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-[8px] text-small text-[#d92d20]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...ranges,
            { id: `${idPrefix}-${Date.now()}`, from: "", to: "" },
          ])
        }
        className="mt-[12px] flex items-center gap-[6px] text-small font-medium text-brand hover:underline"
      >
        <Plus aria-hidden className="size-[16px]" />
        {addLabel}
      </button>
    </fieldset>
  );
}

/**
 * "Availability Preview for Your Guests" — two months of the calendar with
 * available days highlighted and holidays struck out.
 *
 * The file shows this as a static picture. Making it live off the ranges above
 * is the point: an operator who mis-typed a date sees it here immediately
 * rather than after a traveller fails to book.
 */
function AvailabilityPreview({
  logs,
  holidays,
}: {
  logs: Range[];
  holidays: Range[];
}) {
  const firstDate = logs.map((log) => log.from).filter(Boolean).sort()[0];
  const anchor = firstDate ? new Date(firstDate) : new Date();

  const months = [0, 1].map((offset) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  return (
    <div>
      <h3 className="text-body font-medium text-neutral-1">
        Availability Preview for Your Guests
      </h3>
      <p className="mt-[2px] text-small text-brand">
        {firstDate
          ? `effective from ${new Date(firstDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`
          : "Add an availability window to see it here"}
      </p>

      <div className="mt-[18px] space-y-[20px]">
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            logs={logs}
            holidays={holidays}
          />
        ))}
      </div>

      <ul className="mt-[18px] space-y-[6px] text-small text-neutral-2">
        <li className="flex items-center gap-[8px]">
          <span className="size-[12px] bg-brand" aria-hidden />
          Available
        </li>
        <li className="flex items-center gap-[8px]">
          <span className="size-[12px] bg-neutral-4 line-through" aria-hidden />
          Holiday / blocked
        </li>
      </ul>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  logs,
  holidays,
}: {
  year: number;
  month: number;
  logs: Range[];
  holidays: Range[];
}) {
  const label = new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first, matching the m t w t f s s header in the file.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <section aria-label={label}>
      <h4 className="mb-[8px] text-small font-medium text-neutral-1">
        {label.split(" ")[0]}
      </h4>
      <div
        role="grid"
        className="grid grid-cols-7 gap-y-[6px] text-center text-small"
      >
        {["m", "t", "w", "t", "f", "s", "s"].map((day, index) => (
          <span key={index} aria-hidden className="text-neutral-3">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }).map((_, index) => (
          <span key={`pad-${index}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const isHoliday = covers(holidays, iso);
          const isAvailable = !isHoliday && covers(logs, iso);

          return (
            <span
              key={day}
              className={cn(
                "mx-auto flex size-[24px] items-center justify-center",
                isAvailable && "bg-brand font-medium text-white",
                isHoliday && "text-neutral-3 line-through",
                !isAvailable && !isHoliday && "text-neutral-2",
              )}
            >
              {pad(day)}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function covers(ranges: Range[], iso: string) {
  return ranges.some((range) => range.from && range.to && iso >= range.from && iso <= range.to);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
