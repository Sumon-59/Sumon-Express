import { getMailer } from "./mailer";

// THE fire-and-forget door for every email in the codebase (order and
// auth mail alike). The guarantee lives HERE, in one place: delivery
// is never awaited by a handler, and a mailer failure — synchronous
// throw or rejection — is logged, never surfaced to a request.
export const dispatch = (to: string, subject: string, text: string) => {
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
