const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const connectDB = require("./src/config/db");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// routes
const authRoutes = require("./src/routes/auth.routes");
app.use("/api/auth", authRoutes);

// test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// connect database
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
