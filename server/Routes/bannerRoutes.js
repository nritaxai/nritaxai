import express from "express";
import { getBannerUpdates } from "../Controllers/bannerController.js";

const router = express.Router();

router.get("/", getBannerUpdates);

export default router;
