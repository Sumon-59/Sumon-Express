require("dotenv").config();

const app = require("./app");
const connectDB = require("./src/config/db");

// ----- Connect DB + Start server -----
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
