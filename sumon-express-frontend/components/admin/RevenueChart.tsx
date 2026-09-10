"use client";

import React from "react";
import { formatTaka } from "@/types/product";
import { RevenueDay } from "@/types/analytics";

// 30-day revenue as stacked bars: each day's money split into realized
// (delivered) and pending (in the pipeline). Dataviz rules applied:
// validated 2-hue palette (orange/blue, CVD ΔE 31), pending carries a
// 45° hatch so the split never rests on color alone, 2px surface gaps,
// one axis, recessive grid, legend + hover tooltip.
const REALIZED = "#ea580c"; // validated light+dark
const PENDING = "#2563eb";

export default function RevenueChart({ days }: { days: RevenueDay[] }) {
  const [hover, setHover] = React.useState<number | null>(null);

  const W = 660;
  const H = 200;
  const PAD_LEFT = 44;
  const PAD_TOP = 8;
  const PAD_RIGHT = 8;
  const PAD_BOTTOM = 22;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_BOTTOM - PAD_TOP;

  const max = Math.max(1, ...days.map((d) => d.realized + d.pending));
  const barW = plotW / days.length;
  const y = (v: number) => plotH * (v / max);

  // Recessive grid: three round-ish reference lines.
  const gridValues = [max, max / 2];

  const monthDay = (iso: string) => iso.slice(5).replace("-", "/");

  return (
    <div>
      {/* Legend: identity never by color alone — the pending swatch
          carries the same hatch as its bars. */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden>
            <rect width="12" height="12" rx="2" fill={REALIZED} />
          </svg>
          Realized (delivered)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden>
            {/* pattern defined HERE, not in the chart svg — a same-svg
                reference can't break if either svg unmounts alone */}
            <defs>
              <pattern id="pendingHatchLegend" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
              </pattern>
            </defs>
            <rect width="12" height="12" rx="2" fill={PENDING} />
            <rect width="12" height="12" rx="2" fill="url(#pendingHatchLegend)" />
          </svg>
          Pending (in pipeline)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label="Daily revenue for the last 30 days, split into realized and pending"
      >
        <defs>
          <pattern id="pendingHatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* grid + y labels (text wears text tokens, not series color) */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={PAD_TOP + plotH - y(v)}
              y2={PAD_TOP + plotH - y(v)}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text
              x={PAD_LEFT - 6}
              y={PAD_TOP + plotH - y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.45"
            >
              {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="currentColor"
          strokeOpacity="0.15"
        />

        {days.map((d, i) => {
          const x = PAD_LEFT + i * barW;
          const rh = y(d.realized);
          const ph = y(d.pending);
          const gap = ph > 0 && rh > 0 ? 2 : 0; // 2px spacer between stacked fills
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit target bigger than the mark */}
              <rect x={x} y={PAD_TOP} width={barW} height={plotH} fill="transparent" />
              {rh > 0 && (
                <rect
                  x={x + 1.5}
                  width={Math.max(1, barW - 3)}
                  y={PAD_TOP + plotH - rh}
                  height={rh}
                  rx="2"
                  fill={REALIZED}
                />
              )}
              {ph > 0 && (
                <>
                  <rect
                    x={x + 1.5}
                    width={Math.max(1, barW - 3)}
                    y={PAD_TOP + plotH - rh - gap - ph}
                    height={ph}
                    rx="2"
                    fill={PENDING}
                  />
                  <rect
                    x={x + 1.5}
                    width={Math.max(1, barW - 3)}
                    y={PAD_TOP + plotH - rh - gap - ph}
                    height={ph}
                    rx="2"
                    fill="url(#pendingHatch)"
                  />
                </>
              )}
              {/* sparse x labels: weekly */}
              {i % 7 === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="currentColor"
                  fillOpacity="0.45"
                >
                  {monthDay(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* hover readout (single row under the chart — no overlay math) */}
      <div className="mt-1 h-5 text-xs text-muted-foreground">
        {hover != null && (
          <span>
            <span className="font-medium text-foreground">{days[hover].date}</span>
            {" · realized "}
            <span className="tabular-nums">{formatTaka(days[hover].realized)}</span>
            {" · pending "}
            <span className="tabular-nums">{formatTaka(days[hover].pending)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
