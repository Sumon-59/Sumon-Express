const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./src/config/db");

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const adminRoutes = require("./src/routes/admin.routes");
const productRoutes = require("./src/routes/product.routes");
const categoryRoutes = require("./src/routes/category.routes");
const orderRoutes = require("./src/routes/order.routes");

const errorHandler = require("./src/middleware/error.middleware");

const app = express();

/**
 * CORS configuration (credentials + cookies friendly)
 * NOTE: When credentials=true, Access-Control-Allow-Origin cannot be '*'
 */
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://sumon-express-frontend.onrender.com",
  // Add your Vercel domain later:
  // "https://your-app.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ----- Middlewares -----
app.use(cors(corsOptions));

// Preflight must use the SAME cors options (do not use default cors())
app.options("*", cors(corsOptions));

app.use(express.json());

// Cookie parser is REQUIRED for req.cookies (refresh/logout/me)
app.use(cookieParser());

app.use(morgan("dev"));

// ----- Routes -----
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// ----- Error handler (must be after routes) -----
app.use(errorHandler);

// ----- Connect DB + Start server -----
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
