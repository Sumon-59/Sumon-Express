import { Mailer, mailFrom } from "./mailer";
import { requireEnv } from "../utils/env";

// Resend over plain HTTPS — no SDK, the Cloudinary house style. The
// key stays server-side; a non-2xx answer becomes a thrown error that
// the fire-and-forget caller logs (never surfaces to a request).
export const resendMailer: Mailer = {
  name: "resend",
  async sendMail({ to, subject, text }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: mailFrom(), to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Resend refused the email: ${res.status} ${await res.text()}`);
    }
  },
};
