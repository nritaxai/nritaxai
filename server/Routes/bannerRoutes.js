import express from "express";
import Banner from "../Models/Banner.js";
import { deleteCachedValue, getOrSetCachedValue } from "../services/cacheService.js";

const router = express.Router();
const BANNER_KEY = "homepage-banner";
const BANNER_CACHE_LAYER = "banner_response";
const BANNER_CACHE_TTL_SECONDS = Math.max(Number(process.env.BANNER_CACHE_TTL_SECONDS || 300), 30);

router.post("/banner-updates", async (req, res) => {
  try {
    console.log("Banner payload:", req.body);

    const updates = req.body?.updates;
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload: 'updates' must be an array.",
      });
    }

    await Banner.findOneAndUpdate(
      { key: BANNER_KEY },
      { updates },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await deleteCachedValue({
      layer: BANNER_CACHE_LAYER,
      key: BANNER_KEY,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[banner-updates:post]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save banner updates.",
    });
  }
});

router.get("/banner-updates", async (_req, res) => {
  try {
    const updates = await getOrSetCachedValue({
      layer: BANNER_CACHE_LAYER,
      key: BANNER_KEY,
      ttlSeconds: BANNER_CACHE_TTL_SECONDS,
      loader: async () => {
        const banner = await Banner.findOne({ key: BANNER_KEY }).lean();
        return Array.isArray(banner?.updates) ? banner.updates : [];
      },
    });
    return res.status(200).json(Array.isArray(updates) ? updates : []);
  } catch (error) {
    console.error("[banner-updates:get]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch banner updates.",
    });
  }
});

router.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

export default router;
