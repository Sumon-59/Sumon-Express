"use client";

import { Check, X } from "lucide-react";
import { ORDER_STATUS_ORDER, OrderStatus, OrderHistoryEntry } from "@/types/order";
import { formatDate } from "@/lib/format";

const PIPELINE: OrderStatus[] = ORDER_STATUS_ORDER.filter((s) => s !== "cancelled");

// The visual "where is my order?" answer (Slice 12): one dot per
// pipeline step, timestamped from the history array; cancellation is a
// red terminal mark after the last real step. Legacy orders without
// history fall back to createdAt + the current status (steps before it
// show reached-but-undated).
export default function OrderTimeline({
  status,
  history,
  createdAt,
}: {
  status: string;
  history?: OrderHistoryEntry[];
  createdAt?: string;
}) {
  const at = new Map<string, string>();
  for (const h of history ?? []) at.set(h.status, h.at);
  if (!at.has("pending") && createdAt) at.set("pending", createdAt);

  const cancelled = status === "cancelled";
  // Steps reached: with history, exactly the recorded ones; legacy
  // fallback treats every step up to the current status as reached.
  const currentIdx = PIPELINE.indexOf(status as OrderStatus);
  const reached = (step: OrderStatus, i: number) =>
    at.has(step) || (!cancelled && currentIdx >= 0 && i <= currentIdx);

  // A cancelled order stops after its last real step.
  const lastRealIdx = cancelled
    ? Math.max(0, ...PIPELINE.map((s, i) => (at.has(s) ? i : 0)))
    : -1;

  return (
    <ol className="flex flex-wrap items-start gap-x-2 gap-y-3" aria-label="Order timeline">
      {PIPELINE.map((step, i) => {
        if (cancelled && i > lastRealIdx) return null;
        const done = reached(step, i);
        return (
          <li key={step} className="flex items-start gap-2">
            {i > 0 && (
              <span
                className={`mt-2.5 h-0.5 w-6 shrink-0 rounded ${
                  done ? "bg-primary" : "bg-muted"
                }`}
                aria-hidden
              />
            )}
            <div className="flex flex-col items-center">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span
                className={`mt-1 text-xs capitalize ${
                  done ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {step === "pending" ? "placed" : step}
              </span>
              {at.has(step) && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(at.get(step)!)}
                </span>
              )}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex items-start gap-2">
          <span className="mt-2.5 h-0.5 w-6 shrink-0 rounded bg-red-300" aria-hidden />
          <div className="flex flex-col items-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">
              <X className="h-3 w-3" aria-hidden />
            </span>
            <span className="mt-1 text-xs font-medium text-red-700">cancelled</span>
            {at.has("cancelled") && (
              <span className="text-[10px] text-muted-foreground">
                {formatDate(at.get("cancelled")!)}
              </span>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}
