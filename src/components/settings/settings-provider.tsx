"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { performSettingsAction } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { SettingsState } from "@/lib/settings/model";
import {
  applySettingsAction,
  settingsProgress,
  type ActionResult,
  type SettingsAction,
} from "@/lib/settings/rules";
import { todayInIndia } from "@/lib/settings/schema";

/**
 * One store for every Settings section.
 *
 * It lives in the Settings layout, so moving between sections keeps it: the
 * rail's ticks update the moment a section is sent, without a reload. An
 * action runs through the shared rules here first — the update is instant —
 * then on the server, which is the authority. If the server refuses, the
 * store goes back to what it was and says why.
 */

type Toast = { tone: "healthy" | "critical"; message: string; seq: number };

type SettingsContext = {
  state: SettingsState;
  isDemo: boolean;
  /** Server clock at render — what "expires in 5 days" is measured from. */
  now: number;
  today: string;
  progress: ReturnType<typeof settingsProgress>;
  run: (action: SettingsAction) => Promise<ActionResult>;
  replaceState: (state: SettingsState) => void;
  busy: boolean;
  notify: (message: string, tone?: Toast["tone"]) => void;
  /** A section form with unsaved edits registers them here. */
  setDirty: (dirty: boolean) => void;
  /** Navigates, first asking to discard unsaved edits if there are any. */
  navigate: (href: string) => void;
};

const Context = createContext<SettingsContext | null>(null);

export function useSettings() {
  const context = useContext(Context);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}

export function SettingsProvider({
  initialState,
  isDemo,
  now,
  children,
}: {
  initialState: SettingsState;
  isDemo: boolean;
  now: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const stateRef = useRef(state);
  const dirtyRef = useRef(false);
  const [dirty, setDirtyState] = useState(false);

  // Judged on the server's day, so a certificate that expires at midnight
  // reads the same on both sides of hydration.
  const today = useMemo(() => todayInIndia(new Date(now)), [now]);
  const nowMs = useMemo(() => Date.parse(now), [now]);
  const progress = useMemo(() => settingsProgress(state, today), [state, today]);

  const commit = useCallback((next: SettingsState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const notify = useCallback((message: string, tone: Toast["tone"] = "healthy") => {
    setToast({ message, tone, seq: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const run = useCallback(
    async (action: SettingsAction): Promise<ActionResult> => {
      const before = stateRef.current;
      const actorName =
        before.team.find((member) => member.id === before.viewer.memberId)?.name ?? before.viewer.email;
      const local = applySettingsAction(before, action, {
        now: new Date(),
        actorName,
        newId: () => `local-${crypto.randomUUID()}`,
      });
      if (!local.ok) return local;

      commit(local.state);
      setBusy(true);
      try {
        const remote = await performSettingsAction(action);
        if (!remote.ok) {
          commit(before);
          notify(remote.error, "critical");
          return remote;
        }
        const settled = remote.state ?? local.state;
        commit(settled);
        notify(remote.message);
        return { ok: true, state: settled, message: remote.message };
      } catch {
        commit(before);
        const error = "That didn’t save — check your connection and try again.";
        notify(error, "critical");
        return { ok: false, error };
      } finally {
        setBusy(false);
      }
    },
    [commit, notify],
  );

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirtyState(next);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (dirtyRef.current) setPendingHref(href);
      else router.push(href);
    },
    [router],
  );

  // Unsaved edits survive neither a reload nor a click out of Settings, so
  // both ask first. Links anywhere on the page — the nav rail, breadcrumbs —
  // are caught in the capture phase, before Next's router sees the click.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const value = useMemo<SettingsContext>(
    () => ({ state, isDemo, now: nowMs, today, progress, run, replaceState: commit, busy, notify, setDirty, navigate }),
    [state, isDemo, nowMs, today, progress, run, commit, busy, notify, setDirty, navigate],
  );

  return (
    <Context.Provider value={value}>
      {children}

      <Dialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
        size="sm"
        title="Discard your changes?"
        description="You’ve edited this section without saving. Leaving now loses those edits."
        footer={
          <>
            <Button onClick={() => setPendingHref(null)}>Keep editing</Button>
            <Button
              variant="primary"
              onClick={() => {
                const href = pendingHref;
                setDirty(false);
                setPendingHref(null);
                if (href) router.push(href);
              }}
            >
              Discard and leave
            </Button>
          </>
        }
      >
        <p className="m-0 text-[12.5px] text-text-secondary">
          To keep them, stay and use Save draft or Submit.
        </p>
      </Dialog>

      {toast ? (
        <div key={toast.seq} className="toast-bar floating" role={toast.tone === "critical" ? "alert" : "status"}>
          {toast.tone === "critical" ? (
            <AlertTriangle aria-hidden className="toast-icon-critical" />
          ) : (
            <CheckCircle2 aria-hidden className="toast-icon-healthy" />
          )}
          <span className="toast-msg">{toast.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X aria-hidden />
          </button>
        </div>
      ) : null}
    </Context.Provider>
  );
}
