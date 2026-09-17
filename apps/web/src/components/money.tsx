import { formatMoney } from "@splitbill/shared";
import { cn } from "@/lib/utils";

export function Money({
  cents,
  currency = "MYR",
  className,
}: {
  cents: number;
  currency?: string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono font-medium tabular-nums", className)}>
      {formatMoney(cents, currency)}
    </span>
  );
}
