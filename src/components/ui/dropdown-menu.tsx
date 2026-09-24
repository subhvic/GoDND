"use client";

import { DropdownMenu as Menu } from "radix-ui";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dropdown menu — shadcn's structure over Radix, dressed in the source
 * system's popover classes (.pop, .pop-sec, .pop-item). Radix supplies what a
 * hand-rolled menu gets wrong: arrow-key roving focus, typeahead, Escape,
 * focus return to the trigger, and collision-aware placement.
 */
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn("pop z-50", className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pop-sec">
      {label ? <Menu.Label className="pop-sec-lbl">{label}</Menu.Label> : null}
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "pop-item outline-none data-[highlighted]:bg-panel data-[highlighted]:text-text-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        danger && "danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      className={cn(
        "pop-item outline-none data-[highlighted]:bg-panel data-[highlighted]:text-text-primary",
        "data-[state=checked]:text-brand-on-muted",
        className,
      )}
      {...props}
    >
      <span className="capitalize">{children}</span>
      <Menu.ItemIndicator>
        <Check aria-hidden className="size-[14px]" />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}
