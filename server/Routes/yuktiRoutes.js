import express from "express";
import { askYukti, submitYuktiGrievance } from "../Controllers/yuktiController.js";
import { optionalProtect, protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.post("/chat", optionalProtect, askYukti);
router.post("/grievance", protect, submitYuktiGrievance);

export default router;
