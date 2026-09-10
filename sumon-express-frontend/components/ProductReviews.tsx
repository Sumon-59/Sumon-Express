"use client";

import React from "react";
import { Star, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { PageMeta } from "@/types/api";

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  verifiedPurchase?: boolean;
  createdAt?: string;
  user?: { _id?: string; name?: string } | string;
};

type ReviewListResponse = PageMeta & { reviews: Review[] };
type Eligibility = { canReview: boolean; alreadyReviewed: boolean };

const reviewUserId = (r: Review) =>
  typeof r.user === "object" && r.user ? r.user._id : r.user;

// The star PICKER (the display component stays read-only).
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${
              i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({
  productId,
  onRatingChanged,
}: {
  productId: string;
  // The page's own stars (denormalized) go stale after a write —
  // refetching the product is the caller's business.
  onRatingChanged?: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = React.useState<ReviewListResponse | null>(null);
  const [page, setPage] = React.useState(1);
  const [eligibility, setEligibility] = React.useState<Eligibility | null>(null);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const fetchReviews = React.useCallback(async () => {
    try {
      const res = await api.get<ReviewListResponse>(
        `/products/${productId}/reviews?page=${page}&limit=10`
      );
      setData(res.data);
    } catch {
      // a missing review list is not worth an error banner
    }
  }, [productId, page]);

  React.useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  React.useEffect(() => {
    if (!user) {
      setEligibility(null);
      return;
    }
    let alive = true;
    api
      .get<Eligibility>(`/products/${productId}/reviews/eligibility`)
      .then((res) => alive && setEligibility(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId, user]);

  const myReview = data?.reviews.find((r) => user && reviewUserId(r) === user._id);

  const startEdit = (r: Review) => {
    setEditingId(r._id);
    setRating(r.rating);
    setComment(r.comment ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError("Pick a star rating first");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      if (editingId) {
        await api.put(`/reviews/${editingId}`, { rating, comment });
      } else {
        await api.post(`/products/${productId}/reviews`, { rating, comment });
      }
      setRating(0);
      setComment("");
      setEditingId(null);
      setEligibility((prev) => (prev ? { ...prev, alreadyReviewed: true } : prev));
      await fetchReviews();
      onRatingChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save review"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Review) => {
    if (!window.confirm("Delete your review?")) return;
    try {
      setBusy(true);
      await api.delete(`/reviews/${r._id}`);
      setEligibility((prev) => (prev ? { ...prev, alreadyReviewed: false } : prev));
      await fetchReviews();
      onRatingChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete review"));
    } finally {
      setBusy(false);
    }
  };

  const showForm =
    user && eligibility?.canReview && (!eligibility.alreadyReviewed || editingId);

  return (
    <section className="mt-8 rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">
        Reviews{data && data.total > 0 ? ` (${data.total})` : ""}
      </h2>

      {showForm && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border p-4">
          <p className="text-sm font-medium">
            {editingId ? "Edit your review" : "Write a review"}
          </p>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What did you think? (optional)"
            className="w-full rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Submit review"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setRating(0);
                  setComment("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {user && eligibility && !eligibility.canReview && (
        <p className="mt-3 text-sm text-muted-foreground">
          You can review this product once an order containing it is delivered.
        </p>
      )}

      {!data || data.reviews.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {data.reviews.map((r) => (
              <li key={r._id} className="border-b pb-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {typeof r.user === "object" && r.user?.name ? r.user.name : "Customer"}
                  </span>
                  <span className="flex" aria-label={`${r.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        aria-hidden
                        className={`h-3.5 w-3.5 ${
                          i <= r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </span>
                  {r.verifiedPurchase && (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      Verified purchase
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  {myReview?._id === r._id && (
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Delete your review"
                        onClick={() => remove(r)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                {r.comment && <p className="mt-1 text-sm leading-6">{r.comment}</p>}
              </li>
            ))}
          </ul>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                Prev
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
