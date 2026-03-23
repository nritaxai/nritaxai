export default function handler(_req: any, res: any) {
  res.status(200);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json({ ok: true });
}
