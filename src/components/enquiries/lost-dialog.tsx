"use client";

import { useId, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { LOST_REASONS } from "@/lib/types";

/**
 * Marking an enquiry lost asks why. One click on a preset covers most cases;
 * the reason is what turns a pile of lost leads into "we lose on price in
 * November", which is the only reason to record it.
 */
export function LostDialog({
  open,
  onOpenChange,
  contactName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  onConfirm: (reason: string) => void;
}) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Why was this enquiry lost?"
      description={`${contactName}'s enquiry moves to Closed. You can reopen it by changing the stage.`}
      footer={
        <>
          <button type="button" className={buttonClass()} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="submit" form={formId} className={buttonClass({ variant: "primary" })}>
            Mark as lost
          </button>
        </>
      }
    >
      <LostForm
        formId={formId}
        onSubmit={(reason) => {
          onConfirm(reason);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

const OTHER = "__other";

function LostForm({ formId, onSubmit }: { formId: string; onSubmit: (reason: string) => void }) {
  const [choice, setChoice] = useState<string>(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | undefined>();
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const reason = choice === OTHER ? other.trim() : choice;
        if (!reason) {
          setError("Say briefly why, so the team can learn from it");
          return;
        }
        onSubmit(reason);
      }}
    >
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">Reason</legend>
        <div className="lost-options">
          {[...LOST_REASONS, OTHER].map((reason) => (
            <label key={reason} className="lost-option">
              <input
                type="radio"
                name={name}
                value={reason}
                checked={choice === reason}
                onChange={() => {
                  setChoice(reason);
                  setError(undefined);
                }}
              />
              <span>{reason === OTHER ? "Something else" : reason}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {choice === OTHER ? (
        <div className="field mt-[12px]">
          <label htmlFor={`${name}-other`} className="field-label">
            Reason
          </label>
          <input
            id={`${name}-other`}
            className="input"
            maxLength={200}
            autoFocus
            value={other}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setOther(event.target.value);
              setError(undefined);
            }}
          />
          <FieldError id={errorId} message={error} />
        </div>
      ) : null}
    </form>
  );
}
