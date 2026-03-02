import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Config/db.js";
import authRoute from "./Routes/authRoutes.js";
import chatRoute from "./Routes/chatRoutes.js";
import subscriptionRoute from "./Routes/subscriptionRoutes.js";
import calculatorRoute from "./Routes/calculatorRoutes.js";
import pdfRoute from "./Routes/pdfRoutes.js";
// import webhookRoute from "./Routes/webhookRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Connect to MongoDB
connectDB();

const allowedOrigins = [
  "https://nritaxai-cw9w.vercel.app",
  "https://nritax.ai",
  "https://www.nritax.ai",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ Body parser with Razorpay raw body support
app.use(
  express.json({
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

// ✅ Routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/subscription", subscriptionRoute);
app.use("/api/calculator", calculatorRoute);
app.use("/api/pdf", pdfRoute);
// app.use("/razorpay", webhookRoute);

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
