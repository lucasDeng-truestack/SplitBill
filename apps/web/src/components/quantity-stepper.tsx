"use client";

import { cn } from "@/lib/utils";

export function clampQuantity(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Circle({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  if (disabled) {
    return (
      <span
        className="inline-flex size-[46px] items-center justify-center rounded-full border border-rule bg-docket text-[22px] leading-none text-locked"
        aria-hidden
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-[46px] items-center justify-center rounded-full border border-ink bg-docket p-0 font-sans text-[22px] leading-none text-ink"
    >
      {children}
    </button>
  );
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  className,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <Circle
        label="One fewer"
        disabled={value <= min}
        onClick={() => onChange(clampQuantity(value - 1, min, max))}
      >
        –
      </Circle>
      <span className="min-w-[34px] text-center font-mono text-2xl font-medium tabular-nums">{value}</span>
      <Circle
        label="One more"
        disabled={value >= max}
        onClick={() => onChange(clampQuantity(value + 1, min, max))}
      >
        +
      </Circle>
    </div>
  );
}
