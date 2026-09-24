"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

/**
 * Record drawer — the reference Logs page's detail panel, built on shadcn's
 * Dialog composition over Radix.
 *
 * Non-modal on purpose, matching the source: the list stays visible and
 * clickable underneath, so picking another row swaps the record instead of
 * forcing a close-then-open. Radix still supplies what a hand-rolled panel
 * gets wrong — Escape to close, focus moved in on open and returned to the
 * row that opened it, and a labelled dialog role.
 *
 * Rendered inline rather than portaled: it is absolutely positioned against
 * the surface card, which is the clipping boundary, so it overlays the list
 * without covering the navigation.
 */
export function RecordDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Content
        className="record-drawer"
        // Clicking elsewhere in the list is how you move between records, so
        // an outside interaction must not dismiss the panel.
        onInteractOutside={(event) => event.preventDefault()}
        aria-describedby={undefined}
      >
        <div className="record-drawer-head">
          <div className="min-w-0">
            <Dialog.Title className="record-drawer-title">{title}</Dialog.Title>
            {subtitle ? <div className="record-drawer-sub">{subtitle}</div> : null}
          </div>
          <Dialog.Close className="record-drawer-close" aria-label="Close details">
            <X aria-hidden />
          </Dialog.Close>
        </div>
        {actions ? <div className="record-drawer-actions">{actions}</div> : null}
        <div className="record-drawer-body">{children}</div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** A collapsible group of key/value rows inside a record drawer. */
export function RecordSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="record-section" open={defaultOpen}>
      <summary>
        {title}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      {children}
    </details>
  );
}

export function RecordField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="record-field">
      <div className="record-key">{label}</div>
      <div className="record-val">{children ?? "—"}</div>
    </div>
  );
}
