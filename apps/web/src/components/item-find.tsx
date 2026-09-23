"use client";

import { Input } from "@/components/ui/input";
import { shouldOfferItemFind } from "@/lib/filter-items";

export function ItemFind({
  value,
  onChange,
  visibleCount,
  totalCount,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  visibleCount: number;
  totalCount: number;
  placeholder: string;
}) {
  if (!shouldOfferItemFind(totalCount)) return null;

  return (
    <div className="sticky top-0 z-10 -mx-1 bg-docket/95 px-1 pt-3 pb-2 backdrop-blur-[2px]">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-12 rounded-[10px] pr-12 font-sans text-[15px]"
        />
        {value ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-transparent px-2 font-sans text-[13px] text-mute underline"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 px-0.5 font-mono text-[11px] text-mute">
        {value.trim()
          ? visibleCount === 0
            ? `Nothing matches “${value.trim()}”`
            : `${visibleCount} of ${totalCount}`
          : `${totalCount} lines — type to find one`}
      </p>
    </div>
  );
}
