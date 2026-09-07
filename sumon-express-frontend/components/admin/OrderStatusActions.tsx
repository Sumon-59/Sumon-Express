"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CANCELLABLE, NEXT_STATUS, OrderStatus } from "@/types/order";

type Props = {
  status: OrderStatus;
  busy?: boolean;
  onAdvance: (next: OrderStatus) => void;
  onCancel: () => void;
};

// Offers exactly the legal moves for an order's status — the UI mirror
// of the backend state machine. Terminal states get no buttons at all.
export default function OrderStatusActions({ status, busy, onAdvance, onCancel }: Props) {
  const next = NEXT_STATUS[status];
  const canCancel = CANCELLABLE.includes(status);

  if (!next && !canCancel) {
    return <p className="text-sm text-muted-foreground">No actions — this order is final.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {next && (
        <Button size="sm" disabled={busy} onClick={() => onAdvance(next)}>
          Mark {next}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          Cancel order
        </Button>
      )}
    </div>
  );
}
