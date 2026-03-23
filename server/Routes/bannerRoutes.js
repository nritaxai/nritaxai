import express from "express";
import Banner from "../Models/Banner.js";

const router = express.Router();
const BANNER_KEY = "homepage-banner";

router.post("/banner-updates", async (req, res) => {
  try {
    console.log("Banner payload:", req.body);

    const updates = req.body?.updates;
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. 'updates' must be an array.",
      });
    }

    await Banner.findOneAndUpdate(
      { key: BANNER_KEY },
      { key: BANNER_KEY, updates },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

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
    const banner = await Banner.findOne({ key: BANNER_KEY }).lean();
    return res.status(200).json(Array.isArray(banner?.updates) ? banner.updates : []);
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
