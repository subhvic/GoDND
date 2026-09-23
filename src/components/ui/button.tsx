import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * The handoff file draws one filled button (#007F6A, Roboto Bold 12, square
 * corners) and one outlined button. Hover and disabled states are not drawn;
 * they are derived here because shipping a button with no hover feedback fails
 * the "affordance" bar regardless of what the file shows.
 */
const button = cva(
  "inline-flex items-center justify-center gap-[6px] whitespace-nowrap text-small font-bold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-[#006a59] active:bg-[#005a4c]",
        outline:
          "border border-neutral-4 bg-white text-neutral-1 hover:bg-surface-sunken",
        ghost: "text-neutral-1 hover:bg-surface-sunken",
      },
      size: {
        md: "py-[10px] pl-[20px] pr-[24px]",
        sm: "px-[14px] py-[8px]",
        icon: "size-[36px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ variant, size }), className)} {...props} />
  );
}

export { button as buttonVariants };
