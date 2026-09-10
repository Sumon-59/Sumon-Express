import React from "react";
import { Star } from "lucide-react";

// The bare read-only star row — shared by the summary display and the
// review list (one rendering of "n filled stars out of five").
export function StarRow({ value, className = "h-3.5 w-3.5" }: { value: number; className?: string }) {
  return (
    <span className="flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${
            i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

// Star rating display: filled stars by the rounded average, the exact
// number and count in TEXT beside them — identity never rests on the
// icons alone. Renders nothing at zero reviews (absent ≠ zero stars).
export default function Stars({
  avg,
  count,
  compact = false,
}: {
  avg: number;
  count: number;
  compact?: boolean;
}) {
  if (count <= 0) return null;
  const filled = Math.round(avg);

  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Rated ${avg} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
    >
      <StarRow value={filled} />
      <span className="text-xs tabular-nums text-muted-foreground">
        {avg}{compact ? ` (${count})` : ` · ${count} review${count === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}
