import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Docket({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-[402px] flex-col bg-docket shadow-[0_18px_40px_-18px_rgba(32,28,23,0.45),0_2px_0_rgba(32,28,23,0.06)]",
        className,
      )}
    >
      <div className="docket-perf-top" aria-hidden />
      <div className="flex flex-1 flex-col px-[22px] pt-1.5">{children}</div>
      {footer ? (
        <>
          <div className="mt-[22px] px-[22px]">
            <div className="border-t border-dashed border-perf" />
          </div>
          <div className="px-[22px] pt-4 pb-[22px]">{footer}</div>
        </>
      ) : null}
      <div className="docket-perf-bottom" aria-hidden />
    </div>
  );
}
