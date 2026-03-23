import cors from "cors";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = String(process.env.BANNER_API_KEY || "").trim();

app.use(cors());
app.use(express.json());

let bannerData = [];

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeUpdate = (item, index) => {
  const title = normalizeString(item?.title);
  if (!title) return null;

  const priorityValue = Number(item?.priority);

  return {
    label: normalizeString(item?.label || "UPDATE") || "UPDATE",
    title,
    country: normalizeString(item?.country),
    date: normalizeString(item?.date),
    url: normalizeString(item?.url) || "#",
    active: item?.active !== false,
    priority: Number.isFinite(priorityValue) ? priorityValue : index + 1,
  };
};

app.post("/api/banner-updates", (req, res) => {
  const providedApiKey = String(req.get("x-api-key") || "").trim();
  if (API_KEY && providedApiKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const updates = req.body?.updates;

  if (!Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payload. Expected { updates: [] }",
    });
  }

  const normalizedUpdates = updates
    .map((item, index) => normalizeUpdate(item, index))
    .filter(Boolean);

  bannerData = normalizedUpdates;

  console.log("Banner updated:", bannerData);

  return res.status(200).json({
    success: true,
    count: bannerData.length,
  });
});

app.get("/api/banner-updates", (_req, res) => {
  return res.status(200).json(bannerData);
});

app.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Banner service running on port ${PORT}`);
});
