"use client";

import { useSyncExternalStore } from "react";

import * as store from "@/lib/experience-wizard/draft-store";
import { WIZARD_STEPS } from "@/lib/experience-wizard/steps";

/**
 * React's view of the draft store.
 *
 * There is no context provider: the draft is a module-level store, so any
 * component in the wizard can read it without one, and there is exactly one
 * draft in flight at a time.
 */
export function useWizard() {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  return {
    ...snapshot,
    setSection: store.setSection,
    stashSection: store.stashSection,
    markComplete: store.markComplete,
    setSaving: store.setSaving,
    markSaved: store.markSaved,
    markSaveFailed: store.markSaveFailed,
    reset: store.resetDraft,
  };
}

/** How far along the operator is, for the progress bars above the form. */
export function useWizardProgress() {
  const { completed } = useWizard();
  const done = WIZARD_STEPS.filter((step) => completed[step.slug]).length;
  return { done, total: WIZARD_STEPS.length };
}
