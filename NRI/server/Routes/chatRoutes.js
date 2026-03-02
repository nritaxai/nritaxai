import express from "express";
import { chatWithAI, clearChatHistory, getChatHistory } from "../Controllers/chatController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/",protect, chatWithAI);
router.get("/history", protect, getChatHistory);
router.post("/clear", protect, clearChatHistory);

export default router;
