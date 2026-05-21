import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB, { getDbReadiness } from "./Config/db.js";
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
import analyticsRoute from "./Routes/analyticsRoutes.js";
import { requestContextMiddleware } from "./Middlewares/requestContext.js";
import { captureException, initErrorMonitoring } from "./services/monitoring.js";
import { logger } from "./services/logger.js";
import { metricsHandler, recordApiFailureMetric } from "./services/metrics.js";
import { getRedisConnection, isQueueingConfigured, isRedisConfigured } from "./queues/redis.js";
import { getSecurityReadiness, validateSecurityConfiguration } from "./services/securityConfig.js";

dotenv.config();

const app = express();

void initErrorMonitoring();
validateSecurityConfiguration();

const defaultAllowedOrigins = [
  "https://nritaxai-cw9w.vercel.app",
  "https://nritax.ai",
  "https://www.nritax.ai",
  "https://www.nritaxai.com",
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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-guest-session-id",
    "x-api-key",
    "x-request-id",
    "x-tenant-id",
    "x-tenant-key",
  ],
  credentials: true,
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (req.secure || String(req.headers["x-forwarded-proto"] || "").includes("https")) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(requestContextMiddleware);
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

// Keep health checks independent from the database so Render can verify the
// process is alive even if MongoDB is temporarily unavailable.
app.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
  });
});

app.get("/livez", (_req, res) => {
  return res.status(200).json({
    success: true,
    status: "alive",
  });
});

app.get("/metrics", metricsHandler);

app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
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
  const db = getDbReadiness();
  const queueingConfigured = isQueueingConfigured();
  const redisConfigured = isRedisConfigured();
  const security = getSecurityReadiness();
  return res.status(200).json({
    success: true,
    status: db.ready ? "ready" : "degraded",
    dependencies: {
      database: db,
      cache: {
        configured: redisConfigured,
        mode: redisConfigured ? "redis_or_local_fallback" : "local_only",
      },
      queueing: {
        configured: queueingConfigured,
      },
      security,
    },
  });
});

app.get("/readyz", async (_req, res) => {
  const db = getDbReadiness();
  const queueingConfigured = isQueueingConfigured();
  const redisConfigured = isRedisConfigured();
  const security = getSecurityReadiness();
  let queueReady = true;
  let cacheReady = !redisConfigured;

  if (queueingConfigured) {
    queueReady = Boolean(await getRedisConnection());
  }

  if (redisConfigured) {
    cacheReady = Boolean(await getRedisConnection({ requireQueueing: false, role: "cache" }));
  }

  const ready = db.ready && queueReady;
  return res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "not_ready",
    dependencies: {
      database: db,
      cache: {
        configured: redisConfigured,
        ready: cacheReady,
        mode: cacheReady ? "distributed" : "local_fallback",
      },
      queueing: {
        configured: queueingConfigured,
        ready: queueReady,
      },
      security,
    },
  });
});

app.use("/api/auth", authRoute);
app.use("/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/analytics", analyticsRoute);
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
    recordApiFailureMetric({
      method: req.method,
      route: req.originalUrl,
      statusCode: 403,
      errorType: "cors_blocked",
    });
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS policy.",
    });
  }

  if (err?.type === "entity.parse.failed") {
    recordApiFailureMetric({
      method: req.method,
      route: req.originalUrl,
      statusCode: 400,
      errorType: "json_parse_failed",
    });
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }

  if (err?.name === "MulterError") {
    recordApiFailureMetric({
      method: req.method,
      route: req.originalUrl,
      statusCode: 400,
      errorType: err.code || "multer_error",
    });
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

  recordApiFailureMetric({
    method: req.method,
    route: req.originalUrl,
    statusCode: 500,
    errorType: err?.name || "unhandled_server_error",
  });
  req?.logger?.error?.({ error: err?.message || String(err) }, "unhandled server error");
  void captureException(err, {
    requestId: req?.requestId,
    path: req?.originalUrl,
    method: req?.method,
  });
  logger.error({ error: err?.message || String(err) }, "unhandled server error");
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
