// The mailer boundary's shared shapes — implementations and the
// selector both import from HERE (extracting this file broke a
// mailer.ts ⇄ resend.ts import cycle that only worked by accident of
// call-time access; review catch).
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
