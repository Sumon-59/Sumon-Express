// Side-effect import: loads .env BEFORE the imports below are evaluated,
// so anything reading process.env at import time (e.g. CLIENT_URL in
// app.ts) sees the values. Import order matters here — keep this first.
import "dotenv/config";

import app from "./app";
import connectDB from "./src/config/db";

// ----- Connect DB + Start server -----
connectDB();

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
