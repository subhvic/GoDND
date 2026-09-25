"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import {
  assignEnquiry,
  createEnquiry as createEnquiryAction,
  fetchEnquiry,
  markEnquiryRead,
  markEnquiryUnread,
  sendEnquiryMessage,
  setEnquiryPriority,
  updateEnquiryStage,
  type ActionResult,
} from "@/app/dashboard/enquiries/actions";
import type { ExperienceOption } from "@/lib/data/experiences";
import { newMessageId } from "@/lib/enquiries/ids";
import type { NewEnquiryInput } from "@/lib/enquiries/schema";
import { toPreview } from "@/lib/enquiries/views";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type {
  EnquiryAttachment,
  EnquiryDetail,
  EnquiryMessage,
  EnquiryPriority,
  EnquiryRow,
  EnquiryStatus,
  TeamMember,
} from "@/lib/types";

/*
 * The inbox's client state.
 *
 * Lives in the enquiries layout, above both panes, so the list and the open
 * thread read one store: a reply sent in the thread moves its row to
 * "Replied" in the same frame, and switching threads never refetches the
 * list. The server renders the first paint; after that this store is what
 * the operator sees, updated optimistically by their own actions and by
 * Realtime for everyone else's.
 */

export type Delivery = "sending" | "failed";

export type ThreadData = {
  messages: EnquiryMessage[];
  lostReason: string | null;
  booking: { id: string; reference: string } | null;
};

type State = {
  rows: Record<string, EnquiryRow>;
  threads: Record<string, ThreadData>;
  delivery: Record<string, Delivery>;
};

type Action =
  | { type: "reset"; rows: EnquiryRow[] }
  | { type: "thread/hydrate"; detail: EnquiryDetail; preferLocal: boolean }
  | { type: "enquiry/add"; detail: EnquiryDetail }
  | { type: "row/patch"; id: string; patch: Partial<EnquiryRow> }
  | { type: "thread/patch"; id: string; patch: Partial<ThreadData> }
  | { type: "message/add"; enquiryId: string; message: EnquiryMessage; delivery?: Delivery }
  | { type: "message/confirm"; enquiryId: string; message: EnquiryMessage }
  | { type: "message/fail"; id: string }
  | { type: "message/retrying"; id: string }
  | { type: "message/remove"; enquiryId: string; id: string };

const byTime = (a: EnquiryMessage, b: EnquiryMessage) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

function stripDetail(detail: EnquiryDetail): EnquiryRow {
  const row: Partial<EnquiryDetail> = { ...detail };
  delete row.messages;
  delete row.lostReason;
  delete row.booking;
  return row as EnquiryRow;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** How one message changes the row the inbox list shows. */
function applyMessage(row: EnquiryRow, message: EnquiryMessage): EnquiryRow {
  if (message.senderKind === "system") return row;
  const next = { ...row, lastMessageAt: message.createdAt };
  if (message.isInternal) return next;
  if (message.senderKind === "agent") {
    return {
      ...next,
      lastMessage: toPreview(message),
      awaitingReplySince: null,
      // Mirrors the bump_enquiry_activity trigger: a first reply opens it.
      status: row.status === "new" ? "open" : row.status,
    };
  }
  return {
    ...next,
    lastMessage: toPreview(message),
    awaitingReplySince: row.awaitingReplySince ?? message.createdAt,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return { ...state, rows: Object.fromEntries(action.rows.map((row) => [row.id, row])) };

    case "thread/hydrate": {
      const { detail, preferLocal } = action;
      const existing = state.threads[detail.id];
      if (preferLocal && existing) return state;

      const serverIds = new Set(detail.messages.map((message) => message.id));
      const localOnly = existing?.messages.filter((message) => !serverIds.has(message.id)) ?? [];
      const row = preferLocal && state.rows[detail.id] ? state.rows[detail.id] : stripDetail(detail);

      return {
        ...state,
        rows: { ...state.rows, [detail.id]: row },
        threads: {
          ...state.threads,
          [detail.id]: {
            messages: [...detail.messages, ...localOnly].sort(byTime),
            lostReason: existing && preferLocal ? existing.lostReason : detail.lostReason,
            booking: detail.booking,
          },
        },
      };
    }

    case "enquiry/add":
      return {
        ...state,
        rows: { ...state.rows, [action.detail.id]: stripDetail(action.detail) },
        threads: {
          ...state.threads,
          [action.detail.id]: {
            messages: action.detail.messages,
            lostReason: action.detail.lostReason,
            booking: action.detail.booking,
          },
        },
      };

    case "row/patch": {
      const row = state.rows[action.id];
      if (!row) return state;
      return { ...state, rows: { ...state.rows, [action.id]: { ...row, ...action.patch } } };
    }

    case "thread/patch": {
      const thread = state.threads[action.id];
      if (!thread) return state;
      return { ...state, threads: { ...state.threads, [action.id]: { ...thread, ...action.patch } } };
    }

    case "message/add": {
      const thread = state.threads[action.enquiryId];
      const duplicate = thread?.messages.some((message) => message.id === action.message.id);
      if (duplicate) return state;
      const row = state.rows[action.enquiryId];
      return {
        rows: row ? { ...state.rows, [action.enquiryId]: applyMessage(row, action.message) } : state.rows,
        threads: thread
          ? {
              ...state.threads,
              [action.enquiryId]: {
                ...thread,
                messages: [...thread.messages, action.message].sort(byTime),
              },
            }
          : state.threads,
        delivery: action.delivery
          ? { ...state.delivery, [action.message.id]: action.delivery }
          : state.delivery,
      };
    }

    case "message/confirm": {
      const thread = state.threads[action.enquiryId];
      const delivery = withoutKey(state.delivery, action.message.id);
      if (!thread) return { ...state, delivery };
      // Keep the optimistic timestamp: the server's is a few hundred ms
      // later, and re-sorting under the operator's eyes reads as a glitch.
      return {
        ...state,
        delivery,
        threads: {
          ...state.threads,
          [action.enquiryId]: {
            ...thread,
            messages: thread.messages.map((message) =>
              message.id === action.message.id
                ? { ...action.message, createdAt: message.createdAt }
                : message,
            ),
          },
        },
      };
    }

    case "message/fail":
      return { ...state, delivery: { ...state.delivery, [action.id]: "failed" } };

    case "message/retrying":
      return { ...state, delivery: { ...state.delivery, [action.id]: "sending" } };

    case "message/remove": {
      const thread = state.threads[action.enquiryId];
      const delivery = withoutKey(state.delivery, action.id);
      if (!thread) return { ...state, delivery };
      return {
        ...state,
        delivery,
        threads: {
          ...state.threads,
          [action.enquiryId]: {
            ...thread,
            messages: thread.messages.filter((message) => message.id !== action.id),
          },
        },
      };
    }
  }
}

/* ------------------------------------------------------------------------ */

type Toast = { id: number; message: string; tone: "error" | "info" };

export type InboxContextValue = {
  rows: EnquiryRow[];
  rowsById: Record<string, EnquiryRow>;
  threads: Record<string, ThreadData>;
  delivery: Record<string, Delivery>;
  now: Date;
  you: TeamMember | null;
  team: TeamMember[];
  experiences: ExperienceOption[];
  isDemo: boolean;
  selectedId: string | null;
  hydrateThread: (detail: EnquiryDetail) => void;
  send: (
    enquiryId: string,
    draft: { body: string | null; isInternal: boolean; attachments?: EnquiryAttachment[] },
  ) => Promise<boolean>;
  retry: (enquiryId: string, messageId: string) => void;
  discard: (enquiryId: string, messageId: string) => void;
  changeStage: (enquiryId: string, status: EnquiryStatus, lostReason?: string | null) => Promise<boolean>;
  assign: (enquiryId: string, assigneeId: string | null) => void;
  setPriority: (enquiryId: string, priority: EnquiryPriority) => void;
  markRead: (enquiryId: string) => void;
  markUnread: (enquiryId: string) => void;
  createEnquiry: (input: NewEnquiryInput) => Promise<ActionResult<string>>;
  notify: (message: string, tone?: "error" | "info") => void;
};

const InboxContext = createContext<InboxContextValue | null>(null);

export function useInbox(): InboxContextValue {
  const value = useContext(InboxContext);
  if (!value) throw new Error("useInbox must be used inside <InboxProvider>");
  return value;
}

/** Re-render relative times on a slow tick; the first render uses the server's clock. */
const CLOCK_TICK_MS = 30_000;

export function InboxProvider({
  initialRows,
  team,
  you,
  experiences,
  isDemo,
  serverNow,
  children,
}: {
  initialRows: EnquiryRow[];
  team: TeamMember[];
  you: TeamMember | null;
  experiences: ExperienceOption[];
  isDemo: boolean;
  serverNow: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [state, dispatch] = useReducer(reducer, initialRows, (rows): State => ({
    rows: Object.fromEntries(rows.map((row) => [row.id, row])),
    threads: {},
    delivery: {},
  }));

  // A server refresh (live mode, after Realtime reports a new enquiry) hands
  // down a new rows array; adopt it during render rather than in an effect,
  // so there is never a frame showing the stale list.
  const [sourceRows, setSourceRows] = useState(initialRows);
  if (sourceRows !== initialRows) {
    setSourceRows(initialRows);
    dispatch({ type: "reset", rows: initialRows });
  }

  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((message: string, tone: "error" | "info" = "error") => {
    setToast({ id: Date.now(), message, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedId = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/enquiries\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  // Callbacks read the latest state through a ref, so their identities stay
  // stable and memoised children don't re-render on every keystroke.
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    stateRef.current = state;
    selectedRef.current = selectedId;
  });

  const hydrateThread = useCallback(
    (detail: EnquiryDetail) => dispatch({ type: "thread/hydrate", detail, preferLocal: isDemo }),
    [isDemo],
  );

  const deliver = useCallback(
    async (enquiryId: string, message: EnquiryMessage) => {
      const result = await sendEnquiryMessage({
        id: message.id,
        enquiryId,
        body: message.body,
        isInternal: message.isInternal,
        attachments: message.attachments,
      }).catch(() => ({ ok: false as const, error: "You're offline or the server didn't answer." }));

      if (result.ok) {
        dispatch({ type: "message/confirm", enquiryId, message: result.data });
        return true;
      }
      dispatch({ type: "message/fail", id: message.id });
      return false;
    },
    [],
  );

  const changeStage = useCallback(
    async (enquiryId: string, status: EnquiryStatus, lostReason: string | null = null) => {
      const row = stateRef.current.rows[enquiryId];
      if (!row || row.status === status) return true;
      const previous = { status: row.status };
      const previousLost = stateRef.current.threads[enquiryId]?.lostReason ?? null;
      const systemMessageId = newMessageId();

      dispatch({ type: "row/patch", id: enquiryId, patch: { status } });
      dispatch({
        type: "thread/patch",
        id: enquiryId,
        patch: { lostReason: status === "lost" ? lostReason : null },
      });

      const result = await updateEnquiryStage({
        enquiryId,
        status,
        lostReason,
        systemMessageId,
      }).catch(() => ({ ok: false as const, error: "The server didn't answer." }));

      if (!result.ok) {
        dispatch({ type: "row/patch", id: enquiryId, patch: previous });
        dispatch({ type: "thread/patch", id: enquiryId, patch: { lostReason: previousLost } });
        notify(result.error);
        return false;
      }
      dispatch({ type: "message/add", enquiryId, message: result.data.event });
      return true;
    },
    [notify],
  );

  const send = useCallback<InboxContextValue["send"]>(
    async (enquiryId, draft) => {
      const row = stateRef.current.rows[enquiryId];
      // Replying to a closed conversation reopens it — the notice above the
      // composer says so before the operator sends.
      if (row && !draft.isInternal && row.status === "lost") {
        await changeStage(enquiryId, "open");
      }

      const message: EnquiryMessage = {
        id: newMessageId(),
        senderKind: "agent",
        senderId: you?.id ?? null,
        senderName: you?.name ?? "You",
        body: draft.body,
        attachments: draft.attachments ?? [],
        isInternal: draft.isInternal,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "message/add", enquiryId, message, delivery: "sending" });
      return deliver(enquiryId, message);
    },
    [changeStage, deliver, you],
  );

  const retry = useCallback(
    (enquiryId: string, messageId: string) => {
      const message = stateRef.current.threads[enquiryId]?.messages.find((entry) => entry.id === messageId);
      if (!message) return;
      dispatch({ type: "message/retrying", id: messageId });
      void deliver(enquiryId, message);
    },
    [deliver],
  );

  const discard = useCallback((enquiryId: string, messageId: string) => {
    dispatch({ type: "message/remove", enquiryId, id: messageId });
  }, []);

  const assign = useCallback(
    async (enquiryId: string, assigneeId: string | null) => {
      const row = stateRef.current.rows[enquiryId];
      if (!row || (row.assignee?.id ?? null) === assigneeId) return;
      const previous = row.assignee;
      const member = team.find((entry) => entry.id === assigneeId) ?? null;
      dispatch({ type: "row/patch", id: enquiryId, patch: { assignee: member } });

      const result = await assignEnquiry({
        enquiryId,
        assigneeId,
        systemMessageId: newMessageId(),
      }).catch(() => ({ ok: false as const, error: "The server didn't answer." }));
      if (!result.ok) {
        dispatch({ type: "row/patch", id: enquiryId, patch: { assignee: previous } });
        notify(result.error);
        return;
      }
      dispatch({ type: "message/add", enquiryId, message: result.data.event });
    },
    [notify, team],
  );

  const setPriority = useCallback(
    async (enquiryId: string, priority: EnquiryPriority) => {
      const row = stateRef.current.rows[enquiryId];
      if (!row || row.priority === priority) return;
      const previous = row.priority;
      dispatch({ type: "row/patch", id: enquiryId, patch: { priority } });
      const result = await setEnquiryPriority({ enquiryId, priority }).catch(() => ({
        ok: false as const,
        error: "The server didn't answer.",
      }));
      if (!result.ok) {
        dispatch({ type: "row/patch", id: enquiryId, patch: { priority: previous } });
        notify(result.error);
      }
    },
    [notify],
  );

  const markRead = useCallback(
    (enquiryId: string) => {
      // Dispatched unconditionally: the ref can trail a hydrate queued in the
      // same tick, and the reducer applies the two in order.
      dispatch({ type: "row/patch", id: enquiryId, patch: { unreadCount: 0 } });
      // Live: always tell the server — its count may be ahead of ours.
      // Best effort: a failed read receipt must not interrupt the reply.
      if (!isDemo) void markEnquiryRead(enquiryId).catch(() => undefined);
    },
    [isDemo],
  );

  const markUnread = useCallback((enquiryId: string) => {
    const row = stateRef.current.rows[enquiryId];
    if (!row) return;
    dispatch({ type: "row/patch", id: enquiryId, patch: { unreadCount: Math.max(row.unreadCount, 1) } });
    void markEnquiryUnread(enquiryId).catch(() => undefined);
  }, []);

  const createEnquiry = useCallback(
    async (input: NewEnquiryInput): Promise<ActionResult<string>> => {
      const result = await createEnquiryAction(input).catch(() => ({
        ok: false as const,
        error: "The server didn't answer. Check your connection and try again.",
      }));
      if (!result.ok) return result;

      let detail = result.data;
      if (!detail.reference) {
        // Sample workspace: number it after the enquiries this tab holds.
        const highest = Math.max(
          0,
          ...Object.values(stateRef.current.rows).map(
            (row) => Number.parseInt(row.reference.replace(/\D/g, ""), 10) || 0,
          ),
        );
        detail = { ...detail, reference: `ENQ-${String(highest + 1).padStart(6, "0")}` };
      }
      if (!detail.experienceTitle && detail.experienceId) {
        const experience = experiences.find((entry) => entry.id === detail.experienceId);
        detail = { ...detail, experienceTitle: experience?.title ?? null };
      }
      dispatch({ type: "enquiry/add", detail });
      return { ok: true, data: detail.id };
    },
    [experiences],
  );

  // Realtime — live workspaces only. RLS filters what each socket receives.
  const teamRef = useRef(team);
  useEffect(() => {
    teamRef.current = team;
  });
  useEffect(() => {
    if (isDemo) return;
    const supabase = createBrowserSupabase();

    const channel = supabase
      .channel("enquiry-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "enquiry_messages" },
        (payload) => {
          const raw = payload.new as {
            id: string;
            enquiry_id: string;
            sender_kind: EnquiryMessage["senderKind"];
            sender_id: string | null;
            body: string | null;
            attachments: EnquiryAttachment[] | null;
            is_internal: boolean;
            read_at: string | null;
            created_at: string;
          };
          const row = stateRef.current.rows[raw.enquiry_id];
          const senderName =
            raw.sender_kind === "traveller"
              ? (row?.contactName ?? "Traveller")
              : (teamRef.current.find((member) => member.id === raw.sender_id)?.name ?? null);
          dispatch({
            type: "message/add",
            enquiryId: raw.enquiry_id,
            message: {
              id: raw.id,
              senderKind: raw.sender_kind,
              senderId: raw.sender_id,
              senderName,
              body: raw.body,
              attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
              isInternal: raw.is_internal,
              readAt: raw.read_at,
              createdAt: raw.created_at,
            },
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "enquiries" },
        (payload) => {
          const raw = payload.new as {
            id: string;
            status: EnquiryStatus;
            priority: EnquiryPriority;
            assigned_to: string | null;
            unread_for_agent: number;
            last_message_at: string | null;
          };
          if (!stateRef.current.rows[raw.id]) return;
          const open = selectedRef.current === raw.id && document.visibilityState === "visible";
          dispatch({
            type: "row/patch",
            id: raw.id,
            patch: {
              status: raw.status,
              priority: raw.priority,
              assignee: teamRef.current.find((member) => member.id === raw.assigned_to) ?? null,
              // The thread on screen is being read right now.
              unreadCount: open ? 0 : raw.unread_for_agent,
              lastMessageAt: raw.last_message_at,
            },
          });
          if (open && raw.unread_for_agent > 0) void markEnquiryRead(raw.id).catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "enquiries" },
        (payload) => {
          const id = (payload.new as { id: string }).id;
          void fetchEnquiry(id).then((detail) => {
            if (detail) dispatch({ type: "enquiry/add", detail });
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isDemo]);

  const rows = useMemo(() => Object.values(state.rows), [state.rows]);

  const value = useMemo<InboxContextValue>(
    () => ({
      rows,
      rowsById: state.rows,
      threads: state.threads,
      delivery: state.delivery,
      now,
      you,
      team,
      experiences,
      isDemo,
      selectedId,
      hydrateThread,
      send,
      retry,
      discard,
      changeStage,
      assign,
      setPriority,
      markRead,
      markUnread,
      createEnquiry,
      notify,
    }),
    [
      rows,
      state.rows,
      state.threads,
      state.delivery,
      now,
      you,
      team,
      experiences,
      isDemo,
      selectedId,
      hydrateThread,
      send,
      retry,
      discard,
      changeStage,
      assign,
      setPriority,
      markRead,
      markUnread,
      createEnquiry,
      notify,
    ],
  );

  return (
    <InboxContext.Provider value={value}>
      {children}
      {toast ? (
        <div key={toast.id} className="toast-bar floating" role={toast.tone === "error" ? "alert" : "status"}>
          {toast.tone === "error" ? (
            <AlertTriangle aria-hidden className="!text-warning" />
          ) : (
            <CheckCircle2 aria-hidden className="!text-healthy" />
          )}
          <span className="toast-msg">{toast.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X aria-hidden />
          </button>
        </div>
      ) : null}
    </InboxContext.Provider>
  );
}
