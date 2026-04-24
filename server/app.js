import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Config/db.js";
import { createRateLimiter } from "./Middlewares/rateLimit.js";
import authRoute from "./Routes/authRoutes.js";
import chatRoute from "./Routes/chatRoutes.js";
import subscriptionRoute from "./Routes/subscriptionRoutes.js";
import calculatorRoute from "./Routes/calculatorRoutes.js";
import pdfRoute from "./Routes/pdfRoutes.js";
import consultationRoute from "./Routes/consultationRoutes.js";
import yuktiRoute from "./Routes/yuktiRoutes.js";
import bannerRoute from "./Routes/bannerRoutes.js";
import expertOnboardingRoute from "./Routes/expertOnboardingRoutes.js";
import generatePdfRoute from "./Routes/generatePdfRoutes.js";

dotenv.config();

const app = express();

const defaultAllowedOrigins = [
  "https://nritaxai-cw9w.vercel.app",
  "https://nritax.ai",
  "https://www.nritax.ai",
  "capacitor://localhost",
  "https://localhost",
  "https://127.0.0.1",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const envAllowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-session-id", "x-api-key"],
  credentials: true,
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.GLOBAL_RATE_LIMIT_PER_MIN || 120),
  message: "Too many API requests. Please retry in a minute.",
});

app.use("/api", globalRateLimiter);

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "5mb",
    verify: (req, _res, buf) => {
      if (
        req.originalUrl.startsWith("/api/subscription/razorpay-webhook") ||
        req.originalUrl.startsWith("/razorpay/webhook")
      ) {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || "5mb" }));

app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/version", (_req, res) => {
  return res.status(200).json({
    success: true,
    app: "nritax-server",
    version: String(process.env.APP_VERSION || "dev").trim(),
    commit: String(process.env.APP_COMMIT || "unknown").trim(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", (_req, res) => {
  return res.status(200).json({
    success: true,
    status: "ready",
  });
});

app.use("/api/auth", authRoute);
app.use("/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/yukti", yuktiRoute);
app.use("/api/subscription", subscriptionRoute);
app.use("/api/calculator", calculatorRoute);
app.use("/api/generate-pdf", generatePdfRoute);
app.use("/api/pdf", pdfRoute);
app.use("/api/consultations", consultationRoute);
app.use("/api/expert-onboarding", expertOnboardingRoute);
app.use("/api", bannerRoute);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, _next) => {
  if (String(err?.message || "").startsWith("CORS blocked:")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS policy.",
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }

  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file is too large."
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Unexpected upload field. Please reselect your profile file and try again."
          : err.message || "File upload failed.";

    return res.status(400).json({
      success: false,
      message,
    });
  }

  console.error("Unhandled server error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
