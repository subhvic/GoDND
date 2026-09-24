import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * One button family drives every action (source: .hbtn). The primary fill
 * uses --brand-solid with the --brand-hover / --brand-active interaction
 * tokens; everything else stays quiet — transparent on a hairline border.
 */
export type ButtonVariant = "default" | "primary" | "brand-lit" | "danger";
export type ButtonSize = "md" | "small" | "icon";

export function buttonClass({
  variant = "default",
  size = "md",
  active,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  className?: string;
} = {}) {
  return cn(
    "hbtn",
    variant !== "default" && variant,
    size === "small" && "small",
    size === "icon" && "icon",
    active && "active",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
};

export function Button({
  variant,
  size,
  active,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, active, className })}
      {...props}
    />
  );
}
