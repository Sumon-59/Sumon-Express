import { Mailer } from "./types";

// The no-configuration mailer: logs the email. Dev sees every mail in
// full in the server log; PRODUCTION logs only to+subject — a body can
// carry secrets (the password-reset link!) and platform logs are not a
// place for secrets (review catch: this path silently reactivates if
// the Resend key is ever removed). Never throws.
export const consoleMailer: Mailer = {
  name: "console",
  async sendMail({ to, subject, text }) {
    if (process.env.NODE_ENV === "production") {
      console.log(`[mail] to=${to} subject=${JSON.stringify(subject)} (body redacted)`);
      return;
    }
    console.log(`[mail] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
  },
};
