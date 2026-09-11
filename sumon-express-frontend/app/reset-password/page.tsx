"use client";

import React from "react";
import Link from "next/link";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [token, setToken] = React.useState<string>("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Token off the URL directly (no Suspense dance, same as /orders) —
  // then scrubbed from the address bar so browser history never keeps
  // the secret (single-use + 1h already cap the exposure).
  React.useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    if (t) window.history.replaceState(null, "", "/reset-password");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Reset failed — request a new link"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">Choose a new password</h1>

      {done ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Password reset — you can sign in now.
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password (min 8 characters)</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Repeat it</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !token}>
            {submitting ? "Resetting…" : "Reset password"}
          </Button>
          {!token && (
            <p className="text-sm text-muted-foreground">
              This page needs the link from your email.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
