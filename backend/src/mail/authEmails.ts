import { getMailer } from "./mailer";
import { clientUrl } from "../utils/clientUrl";

// Auth emails (Slice 14) — same fire-and-forget contract as
// orderEmails: built synchronously, delivery never awaited by a
// handler, failures logged and swallowed in ONE throw-proof dispatch.
const dispatch = (to: string, subject: string, text: string) => {
  try {
    getMailer()
      .sendMail({ to, subject, text })
      .catch((err) => {
        console.error(`[mail] failed to send "${subject}" to ${to}:`, err);
      });
  } catch (err) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err);
  }
};

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
