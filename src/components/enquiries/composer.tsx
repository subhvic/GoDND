"use client";

import { DropdownMenu as Menu } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IndianRupee,
  Lock,
  MessageCircle,
  Phone,
  SendHorizontal,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { useDraft, useMediaQuery } from "@/components/enquiries/hooks";
import { buttonClass } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuSection } from "@/components/ui/dropdown-menu";
import { MESSAGE_MAX_LENGTH } from "@/lib/enquiries/schema";
import { REPLY_TEMPLATES, fillTemplate } from "@/lib/enquiries/templates";
import type { EnquiryRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "reply" | "note";

/**
 * The reply box.
 *
 * Two modes share one box — a reply the traveller sees, and an internal note
 * only the team sees — and the whole box changes color in note mode, so no
 * one ever posts "they seem price-sensitive, push the cheaper dates" to the
 * traveller by accident.
 *
 * Enter sends on a keyboard; on a touch screen Enter is a new line and the
 * button sends, because a phone keyboard's return key is where people break
 * lines, not where they expect a message to leave.
 */
export function Composer({
  row,
  isDemo,
  onSend,
  onSendQuote,
  onUnspam,
}: {
  row: EnquiryRow;
  isDemo: boolean;
  onSend: (draft: { body: string; isInternal: boolean }) => void;
  onSendQuote: () => void;
  onUnspam: () => void;
}) {
  const reachable = row.hasAccount || Boolean(row.contactEmail);
  const [mode, setMode] = useState<Mode>(reachable ? "reply" : "note");
  const [text, setText] = useDraft(`godnd:enquiry-draft:${row.id}:${mode}`);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const coarse = useMediaQuery("(pointer: coarse)");
  const firstName = row.contactName.split(" ")[0];

  // Text typed before the page hydrated lives only in the DOM; adopt it, or
  // Send would stay disabled beside a box that visibly has a message in it.
  useEffect(() => {
    const element = textareaRef.current;
    if (element && element.value && element.value !== text) setText(element.value);
    // Mount only: after that React owns the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grow with the text up to a cap, then scroll inside.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, coarse ? 140 : 220)}px`;
  }, [text, coarse, mode]);

  if (row.status === "spam") {
    return (
      <div className="composer composer-closed">
        <ShieldAlert aria-hidden />
        <p>Marked as spam. Replies are switched off so nothing reaches this sender.</p>
        <button type="button" className={buttonClass({ size: "small" })} onClick={onUnspam}>
          Not spam
        </button>
      </div>
    );
  }

  const trimmed = text.trim();
  const tooLong = text.length > MESSAGE_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && (mode === "note" || reachable);

  const submit = () => {
    if (!canSend) return;
    onSend({ body: trimmed, isInternal: mode === "note" });
    setText("");
    textareaRef.current?.focus();
  };

  const insert = (value: string) => {
    const element = textareaRef.current;
    if (!element || !text) {
      setText(value);
    } else {
      const start = element.selectionStart ?? text.length;
      const end = element.selectionEnd ?? text.length;
      setText(text.slice(0, start) + value + text.slice(end));
    }
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(length, length);
    });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const phoneDigits = row.contactPhone?.replace(/\D/g, "") ?? "";

  return (
    <div className={cn("composer", mode === "note" && "note")}>
      {row.status === "lost" && mode === "reply" ? (
        <p className="composer-notice">
          This enquiry is marked lost. Sending a reply moves it back to Open.
        </p>
      ) : null}

      {!reachable ? (
        <div className="composer-unreachable" role="note">
          <p>
            <strong>{firstName} can&rsquo;t get replies here</strong> — there&rsquo;s no email or
            GoDND account on file.{" "}
            {row.contactPhone ? "Reach them by phone, then note what you agreed." : "Add an email to reply."}
          </p>
          {row.contactPhone ? (
            <div className="composer-unreachable-actions">
              <a className={buttonClass({ size: "small" })} href={`tel:${row.contactPhone.replace(/\s/g, "")}`}>
                <Phone aria-hidden />
                Call
              </a>
              <a
                className={buttonClass({ size: "small" })}
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden />
                WhatsApp
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="composer-box">
        <div className="composer-modes" role="group" aria-label="Message type">
          <button
            type="button"
            className={cn("composer-mode", mode === "reply" && "active")}
            aria-pressed={mode === "reply"}
            disabled={!reachable}
            title={reachable ? undefined : "No email or GoDND account to reply to"}
            onClick={() => switchMode("reply")}
          >
            Reply
          </button>
          <button
            type="button"
            className={cn("composer-mode", mode === "note" && "active")}
            aria-pressed={mode === "note"}
            onClick={() => switchMode("note")}
          >
            <Lock aria-hidden />
            Internal note
          </button>
        </div>

        <label htmlFor={`composer-${row.id}`} className="sr-only">
          {mode === "note" ? "Internal note, visible to your team only" : `Reply to ${row.contactName}`}
        </label>
        <textarea
          id={`composer-${row.id}`}
          ref={textareaRef}
          className="composer-input"
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX_LENGTH + 200}
          aria-invalid={tooLong || undefined}
          aria-describedby={`composer-hint-${row.id}`}
          placeholder={
            mode === "note"
              ? "Note for your team — the traveller never sees this"
              : `Reply to ${firstName}…`
          }
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            const modifier = event.metaKey || event.ctrlKey;
            if (modifier || (!coarse && !event.shiftKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <div className="composer-tools">
          {mode === "reply" ? (
            <>
              <QuickReplies row={row} onPick={insert} />
              <button
                type="button"
                className={buttonClass({ size: "small", className: "composer-tool" })}
                onClick={onSendQuote}
              >
                <IndianRupee aria-hidden />
                <span className="composer-tool-label">Send quote</span>
              </button>
            </>
          ) : null}

          <span className="flex-1" />
          {text.length > MESSAGE_MAX_LENGTH - 400 ? (
            <span className={cn("composer-count", tooLong && "over")} aria-live="polite">
              {text.length.toLocaleString("en-IN")} / {MESSAGE_MAX_LENGTH.toLocaleString("en-IN")}
            </span>
          ) : null}
          <button
            type="button"
            className={buttonClass({ variant: "primary", className: "composer-send" })}
            disabled={!canSend}
            onClick={submit}
          >
            <SendHorizontal aria-hidden />
            <span className="composer-send-label">{mode === "note" ? "Add note" : "Send"}</span>
          </button>
        </div>
      </div>

      <p id={`composer-hint-${row.id}`} className="composer-hint">
        <span className="composer-delivery">
          {isDemo ? <span className="composer-sample">Sample workspace · nothing is sent</span> : null}
          <span>
            {mode === "note"
              ? "Only your team sees notes."
              : row.hasAccount
                ? `${firstName} gets this in the GoDND app and by email.`
                : row.contactEmail
                  ? `Emailed to ${row.contactEmail}.`
                  : ""}
          </span>
        </span>
        {/* Only while typing — that is when the shortcut is useful, and it
            keeps the idle box calm. */}
        {!coarse && text ? (
          <span className="composer-keys" aria-hidden>
            <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
          </span>
        ) : null}
      </p>
    </div>
  );
}

function QuickReplies({ row, onPick }: { row: EnquiryRow; onPick: (text: string) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={buttonClass({ size: "small", className: "composer-tool" })}>
        <Zap aria-hidden />
        <span className="composer-tool-label">Quick replies</span>
      </Menu.Trigger>
      <DropdownMenuContent side="top" align="start" className="w-[300px] max-w-[calc(100vw-24px)]">
        <DropdownMenuSection label="Insert a saved reply">
          {REPLY_TEMPLATES.map((template) => {
            const filled = fillTemplate(template, row);
            return (
              <Menu.Item
                key={template.id}
                className="pop-item quick-reply outline-none data-[highlighted]:bg-panel data-[highlighted]:text-text-primary"
                onSelect={() => onPick(filled)}
              >
                <span className="min-w-0">
                  <span className="quick-reply-label">{template.label}</span>
                  <span className="quick-reply-body">{filled}</span>
                </span>
              </Menu.Item>
            );
          })}
        </DropdownMenuSection>
      </DropdownMenuContent>
    </Menu.Root>
  );
}
