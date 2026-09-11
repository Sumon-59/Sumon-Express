import { Mail, Mailer } from "./types";

// The test double: records what crossed the mailer boundary. Tests
// assert through the real HTTP seam and read this outbox — never
// re-implementing mail semantics. `failNext()` arms ONE rejection, so
// tests can pin that a mail failure never fails a request.
export const outbox: Mail[] = [];

let failArmed = false;
export const failNext = () => {
  failArmed = true;
};

// One reset for both pieces of fake state — call in beforeEach so an
// armed-but-untriggered failure can't leak into the next test.
export const resetMailFake = () => {
  outbox.length = 0;
  failArmed = false;
};

export const fakeMailer: Mailer = {
  name: "fake",
  async sendMail(mail) {
    if (failArmed) {
      failArmed = false;
      throw new Error("fake mailer: armed failure");
    }
    // The push is synchronous ON PURPOSE — keep it before any await:
    // tests read the outbox immediately after the HTTP call resolves.
    outbox.push(mail);
  },
};
