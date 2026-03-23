import express from "express";
import { getBannerUpdates, updateBannerUpdates } from "../Controllers/bannerController.js";

const router = express.Router();

router.post("/", updateBannerUpdates);
router.get("/", getBannerUpdates);

export default router;
