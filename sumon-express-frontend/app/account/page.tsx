"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, getApiErrorMessage, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setSaved(false);
      const res = await api.put("/auth/password", {
        currentPassword: current,
        newPassword: next,
      });
      // The server rotated our session — adopt the fresh access token
      // so this tab continues seamlessly (other sessions are dead).
      if (res.data?.accessToken) setAccessToken(res.data.accessToken);
      setSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not change the password"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return <main className="mx-auto max-w-sm px-4 py-16 text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-xl font-semibold">Your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user.name ?? "—"} · {user.email}
      </p>

      <h2 className="mt-8 font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Changing it signs out every other device.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">New password (min 8 characters)</Label>
          <Input
            id="next"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repeat the new password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-green-600">
            Password changed — other devices are signed out.
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Changing…" : "Change password"}
        </Button>
      </form>
    </main>
  );
}
