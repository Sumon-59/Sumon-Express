import { Mailer } from "./types";

// The no-configuration mailer: logs the full email. Dev sees every
// mail in the server log; production without a Resend key stays
// functional instead of silently broken. Never throws.
export const consoleMailer: Mailer = {
  name: "console",
  async sendMail({ to, subject, text }) {
    console.log(`[mail] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
  },
};
