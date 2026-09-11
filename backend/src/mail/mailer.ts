import { fakeMailer } from "./fake";
import { resendMailer } from "./resend";
import { consoleMailer } from "./console";

// The mailer boundary (Slice 13) — the payments-provider pattern for
// mail. Callers NEVER await delivery through this interface's users
// (see orderEmails): the response's job is to report the order's fate,
// and the order's fate does not depend on mail.
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  name: "fake" | "console" | "resend";
  sendMail(mail: Mail): Promise<void>;
}

export const mailFrom = () =>
  process.env.MAIL_FROM ?? "Sumon Express <onboarding@resend.dev>";

// test → fake (in-memory outbox); RESEND_API_KEY → resend; otherwise
// console — dev and unconfigured production both stay functional, with
// every mail visible in the server log.
export const getMailer = (): Mailer => {
  if (process.env.NODE_ENV === "test") return fakeMailer;
  if (process.env.RESEND_API_KEY) return resendMailer;
  return consoleMailer;
};
