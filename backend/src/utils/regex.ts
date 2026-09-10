// Escape a user-typed string for use inside a RegExp/$regex. Without
// this, searching "c++" or "(" is a Mongo invalid-regex 500 — the
// public search box must never crash on punctuation.
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
