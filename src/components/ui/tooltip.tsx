"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tooltip — shadcn's composition over Radix, restyled with the system tokens.
 *
 * Exists for one job in particular: the collapsed 66px nav shows icons only,
 * and rule 04 says no icon-only control goes unlabeled. A native `title` is
 * invisible to keyboard users and slow to appear; this shows on focus too.
 */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  label,
  side = "right",
  disabled,
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  /** Suppress without unmounting, e.g. when the label is already visible. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) return <>{children}</>;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 rounded-sm border border-border-panel bg-raised px-2 py-1",
            "text-[11.5px] font-medium text-text-primary shadow-[var(--shadow-dropdown)]",
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
