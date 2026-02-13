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
app.use(cors({
  origin: ["http://localhost:5173", "https://nritaxai.vercel.app"],
  credentials: true,
}));

// Routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// app.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const response = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [
//         { role: "system", content: "You are an NRI tax assistant." },
//         { role: "user", content: message },
//       ],
//     });

//     res.json({ reply: response.choices[0].message.content });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error");
//   }
// });

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});