import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-[52px] w-full rounded-xl bg-inset px-3.5 text-base text-ink outline-none placeholder:text-mute",
        className,
      )}
      {...props}
    />
  );
}
