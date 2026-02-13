import { generateChatResponse } from "../Config/openaiService.js";

export const chatResponse = async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || messages.trim() === "") {
            return res.status(400).json({ error: "Message is required" });
        }

        const msg = [
            {
                role: "system",
                content: `
You are NRITAX AI, a professional NRI tax assistant.
Provide structured, India-focused tax guidance.
Be clear, concise, and practical.
        `,
            },
            { role: "user", content: messages },
        ];

        const reply = await generateChatResponse(msg);

        return res.status(200).json({ reply });

    } catch (error) {
        console.error("OpenAI Error:", error?.response?.data || error.message);

        if (error.message?.includes("quota") || error.message?.includes("429")) {
            return res.status(429).json({
                error: "AI quota exceeded. Please check billing.",
            });
        }

        return res.status(500).json({
            error: "AI service unavailable",
        });
    }
};
