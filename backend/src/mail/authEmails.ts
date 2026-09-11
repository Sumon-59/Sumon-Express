import { dispatch } from "./dispatch";
import { clientUrl } from "../utils/clientUrl";

// Auth emails (Slice 14) — delivered through the ONE fire-and-forget
// door (mail/dispatch): built synchronously, never awaited, failures
// swallowed.

// The raw token exists ONLY in this email and in the shopper's hands —
// the database stores its hash.
export const notifyPasswordReset = (email: string, rawToken: string) => {
  dispatch(
    email,
    "Reset your password — Sumon Express",
    `Someone (hopefully you) asked to reset the password for this account.\n\n` +
      `Reset it here (the link works once and expires in 1 hour):\n` +
      `${clientUrl()}/reset-password?token=${rawToken}\n\n` +
      `If this wasn't you, ignore this email — nothing changes without the link.`
  );
};

export const notifyPasswordChanged = (email: string) => {
  dispatch(
    email,
    "Your password was changed — Sumon Express",
    `The password for this account was just changed, and every other ` +
      `signed-in session has been logged out.\n\n` +
      `If this wasn't you, reset your password immediately from the login page.`
  );
};

export const notifyLogin = (email: string, userAgent: string) => {
  dispatch(
    email,
    "New sign-in to your account — Sumon Express",
    `Your account just signed in.\n\nWhen: ${new Date().toUTCString()}\n` +
      `Device: ${userAgent || "unknown"}\n\n` +
      `If this wasn't you, change your password now.`
  );
};
