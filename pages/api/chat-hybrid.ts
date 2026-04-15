import { ChatService } from "../../server/hybrid/services/chat.service";

const chatService = new ChatService();

const sendJson = (res: any, status: number, body: unknown) => {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(body);
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const message = String(req.body?.message || req.body?.query || "").trim();

    if (!message) {
      return sendJson(res, 400, {
        success: false,
        message: "Request body must include a message",
      });
    }

    const result = await chatService.handleChat({
      message,
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
      userId: typeof req.body?.userId === "string" ? req.body.userId : undefined,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      message: error instanceof Error ? error.message : "Hybrid chat request failed",
    });
  }
}
