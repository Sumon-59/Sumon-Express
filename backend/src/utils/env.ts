// Strict mode forces us to face a truth the old JS hid: process.env
// values are `string | undefined`. Instead of silencing that, we check
// once and fail with a clear message if the variable is missing.
export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};
