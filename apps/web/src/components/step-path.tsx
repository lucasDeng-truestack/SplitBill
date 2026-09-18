import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = ["Review", "Collect", "Summary"] as const;
export type FlowStep = (typeof STEPS)[number];

export function StepPath({
  current,
  billId,
}: {
  current: FlowStep;
  billId: string;
}) {
  const hrefFor = (step: FlowStep) => {
    if (step === "Review") return `/bills/${billId}/review`;
    if (step === "Collect") return `/bills/${billId}/collect`;
    return `/bills/${billId}/summary`;
  };

  return (
    <div>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-mute no-underline hover:text-ink">
        ← Home
      </Link>
      <nav aria-label="Bill steps" className="flex items-center gap-0 pb-[18px]">
      {STEPS.map((step, index) => {
        const active = step === current;
        const node = (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[11px]",
              active ? "font-medium text-amber" : "text-mute",
            )}
          >
            <span
              className={cn("rounded-full", active ? "size-[9px] bg-amber" : "size-[7px] bg-perf")}
            />
            {step}
          </span>
        );

        return (
          <span key={step} className="flex min-w-0 flex-1 items-center last:flex-none">
            {active ? (
              node
            ) : (
              <Link href={hrefFor(step)} className="text-inherit no-underline hover:text-ink">
                {node}
              </Link>
            )}
            {index < STEPS.length - 1 ? (
              <span className="mx-[7px] h-px min-w-2 flex-1 border-t border-dashed border-perf" />
            ) : null}
          </span>
        );
      })}
      </nav>
    </div>
  );
}
