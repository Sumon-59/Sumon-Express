import rateLimit from "express-rate-limit";

const sensitiveLimiter = (message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // max 10 requests per IP
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
  });

export const loginLimiter = sensitiveLimiter(
  "Too many login attempts. Please try again later."
);

// Slice 14: each credential route gets its OWN bucket — sharing one
// would let reset attempts lock out logins (and vice versa). Without
// these, forgot-password is an inbox-bombing/quota-burning lever and
// PUT /password lets a stolen access token brute-force the current
// password unthrottled.
export const forgotPasswordLimiter = sensitiveLimiter(
  "Too many reset requests. Please try again later."
);
export const resetPasswordLimiter = sensitiveLimiter(
  "Too many reset attempts. Please try again later."
);
export const passwordChangeLimiter = sensitiveLimiter(
  "Too many password change attempts. Please try again later."
);
