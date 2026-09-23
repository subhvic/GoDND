import { emptyDraft, type ExperienceDraft } from "@/lib/experience-wizard/schema";
import type { WizardStepSlug } from "@/lib/experience-wizard/steps";

/**
 * The wizard draft, held outside React.
 *
 * sessionStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect. That
 * removes the cascading render on mount, and lets the server and the first
 * client render agree: both start from `serverSnapshot`, and React swaps in the
 * stored draft once hydration finishes.
 *
 * Why persist at all: operators fill these seven steps on patchy connections
 * in the Northeast. Losing a half-built itinerary to a dropped request is the
 * worst failure this form has, so every keystroke is mirrored locally and only
 * "Save as Draft" touches the network.
 *
 * sessionStorage rather than localStorage — a draft should not outlive the tab
 * and resurface weeks later as a surprise.
 */

const STORAGE_KEY = "godnd:experience-draft";

export type CompletedMap = Partial<Record<WizardStepSlug, boolean>>;

export type DraftSnapshot = {
  draft: ExperienceDraft;
  completed: CompletedMap;
  /** False until the stored draft has been read back. */
  hydrated: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
};

const serverSnapshot: DraftSnapshot = {
  draft: emptyDraft,
  completed: {},
  hydrated: false,
  saving: false,
  lastSavedAt: null,
};

let snapshot: DraftSnapshot = serverSnapshot;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;

  let restored: Pick<DraftSnapshot, "draft" | "completed"> = {
    draft: emptyDraft,
    completed: {},
  };

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        draft?: Partial<ExperienceDraft>;
        completed?: CompletedMap;
      };
      restored = {
        // Merged, not replaced: a draft saved before a field existed must not
        // render undefined into a controlled input.
        draft: { ...emptyDraft, ...parsed.draft },
        completed: parsed.completed ?? {},
      };
    }
  } catch {
    // Unreadable, corrupt, or blocked (private mode) — start clean.
  }

  snapshot = { ...snapshot, ...restored, hydrated: true };
}

function persist() {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ draft: snapshot.draft, completed: snapshot.completed }),
    );
  } catch {
    // Storage full or blocked; the in-memory draft still works.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): DraftSnapshot {
  load();
  return snapshot;
}

export function getServerSnapshot(): DraftSnapshot {
  return serverSnapshot;
}

function update(patch: Partial<DraftSnapshot>, shouldPersist = true) {
  snapshot = { ...snapshot, ...patch };
  if (shouldPersist) persist();
  emit();
}

export function setSection<K extends keyof ExperienceDraft>(
  key: K,
  values: ExperienceDraft[K],
) {
  update({ draft: { ...snapshot.draft, [key]: values } });
}

/**
 * Autosave write: persists immediately but does NOT notify subscribers.
 *
 * Persisting on every change rather than on a timer removes a whole class of
 * bug — anything still inside a debounce window is lost to a refresh, a closed
 * tab, or a quick step change, and an unload-time flush is not reliable enough
 * to depend on. The draft is a few KB, so a synchronous write per change costs
 * nothing measurable.
 *
 * Skipping the notify is what keeps that affordable: no component renders the
 * section currently being edited from this store (the form owns those values
 * while it is mounted), so waking every subscriber on each keystroke would be
 * re-render churn for no visible change. Readers pick the values up on their
 * next render, and `setSection` on submit notifies properly.
 */
export function stashSection<K extends keyof ExperienceDraft>(
  key: K,
  values: ExperienceDraft[K],
) {
  snapshot = { ...snapshot, draft: { ...snapshot.draft, [key]: values } };
  persist();
}

export function markComplete(slug: WizardStepSlug, complete: boolean) {
  update({ completed: { ...snapshot.completed, [slug]: complete } });
}

export function setSaving(saving: boolean) {
  update({ saving }, false);
}

export function markSaved() {
  update({ saving: false, lastSavedAt: new Date() }, false);
}

export function resetDraft() {
  snapshot = { ...serverSnapshot, hydrated: true };
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  emit();
}
