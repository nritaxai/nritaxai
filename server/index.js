import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Config/db.js"
import authRoute from './Routes/authRoute.js';
import chatRoute from "./Routes/chatRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "https://nritaxai.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});