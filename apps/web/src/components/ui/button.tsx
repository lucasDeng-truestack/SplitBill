import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,border-color] duration-150 focus-visible:outline-none disabled:pointer-events-none active:enabled:scale-[0.985]",
  {
    variants: {
      variant: {
        primary: "h-14 w-full bg-ink text-[17px] text-docket disabled:bg-tan disabled:text-faint",
        secondary:
          "min-h-12 w-full border border-ink bg-transparent text-[15px] text-ink disabled:border-perf disabled:text-faint",
        quiet:
          "min-h-12 w-full border border-perf bg-transparent text-[15px] text-ink hover:border-ink disabled:border-rule disabled:text-faint",
        ghost: "min-h-11 px-0 text-sm font-normal text-mute underline disabled:text-faint",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
