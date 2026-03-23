type BannerUpdate = {
  label?: string;
  title?: string;
  country?: string;
  date?: string;
  url?: string;
  active?: boolean;
  priority?: number;
};

let bannerData: BannerUpdate[] = [];

const sendJson = (res: any, status: number, body: unknown) => {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(body);
};

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeUpdate = (item: BannerUpdate, index: number) => {
  const title = normalizeString(item?.title);
  if (!title) return null;

  const priorityValue = Number(item?.priority);

  return {
    label: normalizeString(item?.label) || "IMPORTANT",
    title,
    country: normalizeString(item?.country),
    date: normalizeString(item?.date),
    url: normalizeString(item?.url) || "#",
    active: item?.active !== false,
    priority: Number.isFinite(priorityValue) ? priorityValue : index + 1,
  };
};

export default async function handler(req: any, res: any) {
  if (req.method === "POST") {
    const updates = req.body?.updates;

    if (!Array.isArray(updates)) {
      return sendJson(res, 400, { error: "Invalid payload" });
    }

    const normalizedUpdates = updates
      .map((item: BannerUpdate, index: number) => normalizeUpdate(item, index))
      .filter(Boolean);

    if (!normalizedUpdates.length) {
      return sendJson(res, 400, { error: "Invalid payload" });
    }

    bannerData = normalizedUpdates;
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "GET") {
    return sendJson(res, 200, bannerData);
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}
