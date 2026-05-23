import express from "express";
import { chatWithAI, clearChatHistory, getChatConversations, getChatHistory } from "../Controllers/chatController.js";
import { optionalProtect, requireTermsAcceptance } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", optionalProtect, requireTermsAcceptance, chatWithAI);
router.get("/conversations", optionalProtect, requireTermsAcceptance, getChatConversations);
router.get("/history", optionalProtect, requireTermsAcceptance, getChatHistory);
router.post("/clear", optionalProtect, requireTermsAcceptance, clearChatHistory);

export default router;
