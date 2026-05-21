import express from "express";
import { askYukti, submitYuktiGrievance } from "../Controllers/yuktiController.js";
import { optionalProtect, protect, requireTermsAcceptance } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/chat", optionalProtect, requireTermsAcceptance, askYukti);
router.post("/grievance", protect, requireTermsAcceptance, submitYuktiGrievance);

export default router;
