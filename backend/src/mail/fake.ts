import { Mail, Mailer } from "./mailer";

// The test double: records what crossed the mailer boundary. Tests
// assert through the real HTTP seam and read this outbox — never
// re-implementing mail semantics. `failNext()` arms ONE rejection, so
// tests can pin that a mail failure never fails a request.
export const outbox: Mail[] = [];

let failArmed = false;
export const failNext = () => {
  failArmed = true;
};

export const fakeMailer: Mailer = {
  name: "fake",
  async sendMail(mail) {
    if (failArmed) {
      failArmed = false;
      throw new Error("fake mailer: armed failure");
    }
    outbox.push(mail);
  },
};
