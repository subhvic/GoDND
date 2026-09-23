"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  emptyDraft,
  type ExperienceDraft,
} from "@/lib/experience-wizard/schema";
import { WIZARD_STEPS, type WizardStepSlug } from "@/lib/experience-wizard/steps";

/**
 * Wizard state.
 *
 * The draft lives in one client store rather than being written to the server
 * on every keystroke. Operators fill these forms on patchy connections in the
 * Northeast; losing a half-finished itinerary to a dropped request is the worst
 * possible failure here. So:
 *
 *   - every change is mirrored to sessionStorage immediately (survives a
 *     refresh, a crash, or an accidental back-navigation)
 *   - "Save as Draft" is the only thing that hits the network
 *   - a completed step is remembered so the rail can show its green tick
 *
 * sessionStorage rather than localStorage: a draft should not outlive the tab
 * and reappear weeks later as a surprise.
 */

const STORAGE_KEY = "godnd:experience-draft";

type CompletedMap = Partial<Record<WizardStepSlug, boolean>>;

type WizardContextValue = {
  draft: ExperienceDraft;
  completed: CompletedMap;
  /** True until sessionStorage has been read, so forms don't flash empty. */
  hydrated: boolean;
  lastSavedAt: Date | null;
  saving: boolean;
  setSection: <K extends keyof ExperienceDraft>(
    key: K,
    values: ExperienceDraft[K],
  ) => void;
  markComplete: (slug: WizardStepSlug, complete: boolean) => void;
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
  reset: () => void;
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ExperienceDraft>(emptyDraft);
  const [completed, setCompleted] = useState<CompletedMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Restore on mount. Wrapped in try/catch because sessionStorage throws in
  // private-mode browsers rather than returning null.
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          draft: ExperienceDraft;
          completed: CompletedMap;
        };
        // Merged rather than replaced, so a draft saved before a new field was
        // added doesn't render undefined into a controlled input.
        setDraft({ ...emptyDraft, ...parsed.draft });
        setCompleted(parsed.completed ?? {});
      }
    } catch {
      // Unreadable or corrupt draft — start clean rather than crash.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ draft, completed }),
      );
    } catch {
      // Storage full or blocked; the in-memory draft still works.
    }
  }, [draft, completed, hydrated]);

  const setSection = useCallback<WizardContextValue["setSection"]>(
    (key, values) => {
      setDraft((current) => ({ ...current, [key]: values }));
    },
    [],
  );

  const markComplete = useCallback(
    (slug: WizardStepSlug, complete: boolean) => {
      setCompleted((current) => ({ ...current, [slug]: complete }));
    },
    [],
  );

  const markSaved = useCallback(() => {
    setLastSavedAt(new Date());
    setSaving(false);
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    setCompleted({});
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const value = useMemo(
    () => ({
      draft,
      completed,
      hydrated,
      lastSavedAt,
      saving,
      setSection,
      markComplete,
      setSaving,
      markSaved,
      reset,
    }),
    [
      draft,
      completed,
      hydrated,
      lastSavedAt,
      saving,
      setSection,
      markComplete,
      markSaved,
      reset,
    ],
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used inside a WizardProvider");
  }
  return context;
}

/** How far along the operator is, for the progress bars above the form. */
export function useWizardProgress() {
  const { completed } = useWizard();
  const done = WIZARD_STEPS.filter((step) => completed[step.slug]).length;
  return { done, total: WIZARD_STEPS.length };
}
