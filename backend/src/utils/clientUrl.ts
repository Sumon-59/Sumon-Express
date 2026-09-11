// The deployed frontend's origin — used by gateway redirects (Slice 11)
// and password-reset links (Slice 14). CLIENT_URL overrides — EXCEPT a
// localhost value on a deployed platform, which is always a
// misconfiguration (deploy probes traced exactly that on Render).
export const clientUrl = (): string => {
  const configured = process.env.CLIENT_URL;
  const deployed = !!process.env.RENDER || process.env.NODE_ENV === "production";
  if (configured && !(deployed && /^https?:\/\/localhost/i.test(configured))) {
    return configured;
  }
  return deployed ? "https://sumon-express.vercel.app" : "http://localhost:3000";
};
