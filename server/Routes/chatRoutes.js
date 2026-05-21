import express from "express";
import { chatWithAI, clearChatHistory, getChatHistory } from "../Controllers/chatController.js";
import { optionalProtect, requireTermsAcceptance } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", optionalProtect, requireTermsAcceptance, chatWithAI);
router.get("/history", optionalProtect, requireTermsAcceptance, getChatHistory);
router.post("/clear", optionalProtect, requireTermsAcceptance, clearChatHistory);

export default router;
