import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

// These are still JavaScript modules — that's fine: TypeScript files may
// depend on JavaScript ones during the migration (never the reverse).
import authRoutes from "./src/routes/auth.routes";
import userRoutes from "./src/routes/user.routes";
import adminRoutes from "./src/routes/admin.routes";
import productRoutes from "./src/routes/product.routes";
import categoryRoutes from "./src/routes/category.routes";
import orderRoutes from "./src/routes/order.routes";

import errorHandler from "./src/middleware/error.middleware";

const app = express();

// Behind Render's proxy: needed for secure cookies + correct client IPs (rate limiting)
app.set("trust proxy", 1);

/**
 * CORS configuration (credentials + cookies friendly)
 * NOTE: When credentials=true, Access-Control-Allow-Origin cannot be '*'
 */
const allowedOrigins: string[] = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "https://sumon-express-frontend.onrender.com",
  "https://sumon-express.vercel.app",
  "https://sumon-express-c5egp6hae-md-sumon-hossains-projects.vercel.app",
];

// Allow an extra origin via env (e.g. a new Vercel domain) without a code change
if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
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
app.use(helmet());

app.use(cors(corsOptions));

app.use(express.json());

// Cookie parser is REQUIRED for req.cookies (refresh/logout/me)
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

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

// `export =` compiles to `module.exports = app`, so the tests'
// `import app from "../app"` and server.ts both keep working.
export = app;
