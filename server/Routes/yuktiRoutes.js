import express from "express";
import { askYukti } from "../Controllers/yuktiController.js";
import { optionalProtect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/chat", optionalProtect, askYukti);

export default router;
