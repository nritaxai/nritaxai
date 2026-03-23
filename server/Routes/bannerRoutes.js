import express from "express";
import { getBannerHealth, getBannerUpdates, updateBannerUpdates } from "../Controllers/bannerController.js";

const router = express.Router();

router.get("/health", getBannerHealth);
router.post("/", updateBannerUpdates);
router.get("/", getBannerUpdates);

export default router;
