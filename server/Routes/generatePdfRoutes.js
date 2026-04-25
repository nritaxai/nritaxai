import express from "express";

import { protect } from "../Middlewares/authMiddleware.js";
import { generatePdf } from "../Controllers/generatePdfController.js";

const router = express.Router();

router.post("/", protect, generatePdf);

export default router;
