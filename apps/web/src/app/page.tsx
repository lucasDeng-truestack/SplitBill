import { parseReceiptListRange, type ReceiptListItemDto, type ReceiptListRange } from "@splitbill/shared";
import { Docket } from "@/components/docket";
import { ReceiptHistory } from "@/components/receipt-history";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TypeItIn } from "./type-it-in";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function loadReceipts(range: ReceiptListRange): Promise<ReceiptListItemDto[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/receipts?range=${range}`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { receipts: ReceiptListItemDto[] };
    return data.receipts ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseReceiptListRange(params.range, "today");
  const receipts = await loadReceipts(range);

  return (
    <Docket
      footer={
        <div>
          <a href="/bills/new" className={cn(buttonVariants(), "h-[60px] text-lg no-underline")}>
            {receipts.length === 0 ? "Photograph the receipt" : "Snap a receipt"}
          </a>
          <p className="mt-2.5 text-center text-[13px] text-mute">
            {receipts.length === 0 ? (
              <>
                No receipt? <TypeItIn label="Type the items in yourself" />.
              </>
            ) : (
              <>
                Or <TypeItIn />.
              </>
            )}
          </p>
        </div>
      }
    >
      <p className="mt-4 font-mono text-xs text-mute">Receipt Splitter</p>
      <h1 className="mt-4 max-w-[16ch] text-[38px] leading-[1.05] font-semibold tracking-[-0.035em]">Who had what?</h1>
      <p className="mt-2.5 max-w-[30ch] text-base leading-snug text-mute">
        Snap the bill, walk up to each person, take what they owe, then pay the counter.
      </p>

      {range === "all" && receipts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[18px] pb-5 pt-9">
          <div className="flex w-[150px] -rotate-3 flex-col bg-inset">
            <div className="h-[7px] bg-[radial-gradient(circle_at_5px_0,transparent_0_4px,#f6efe2_4.5px)] bg-size-[10px_7px] bg-repeat-x" />
            <div className="flex flex-col gap-[9px] px-3.5 py-3.5 pb-4">
              <div className="h-[7px] w-[70%] rounded-sm bg-table" />
              <div className="h-[7px] w-[90%] rounded-sm bg-[#e6dcca]" />
              <div className="h-[7px] w-[55%] rounded-sm bg-[#e6dcca]" />
              <div className="h-[7px] w-[80%] rounded-sm bg-[#e6dcca]" />
              <div className="my-0.5 border-t border-dashed border-perf" />
              <div className="h-[9px] w-[45%] self-end rounded-sm bg-table" />
            </div>
            <div className="h-[7px] bg-[radial-gradient(circle_at_5px_7px,transparent_0_4px,#f6efe2_4.5px)] bg-size-[10px_7px] bg-repeat-x" />
          </div>
          <p className="max-w-[26ch] text-center text-base leading-snug text-mute">
            Got the paper bill? Photograph it, split it at the table, then pay the counter.
          </p>
        </div>
      ) : (
        <ReceiptHistory range={range} receipts={receipts} />
      )}
    </Docket>
  );
}
