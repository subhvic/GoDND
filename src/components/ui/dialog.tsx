"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Modal dialog — shadcn's composition over Radix, dressed in the system's
 * surface tokens. A centred card from 640px up; below that it becomes a
 * bottom sheet, because a centred card on a phone leaves its primary action
 * at the top of the screen, out of thumb reach, and fights the keyboard.
 *
 * Radix supplies the parts that are easy to get wrong: focus trapped inside
 * and returned to the trigger on close, Escape and scrim-click to dismiss,
 * scroll lock, and a labelled dialog role.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  children,
  onOpenAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Actions, right-aligned; the primary action goes last. */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onOpenAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-scrim" />
        <DialogPrimitive.Content
          className={cn("dialog", `dialog-${size}`)}
          // Without a description Radix warns unless describedby is
          // explicitly cleared; with one, it wires the id itself.
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className="dialog-head">
            <div className="min-w-0">
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="dialog-desc">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="dialog-close" aria-label="Close">
              <X aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-foot">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
