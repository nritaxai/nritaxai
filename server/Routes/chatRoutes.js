import express from "express";
import { chatWithAI, clearChatHistory, getChatHistory } from "../Controllers/chatController.js";
import { optionalProtect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", optionalProtect, chatWithAI);
router.get("/history", optionalProtect, getChatHistory);
router.post("/clear", optionalProtect, clearChatHistory);

export default router;
