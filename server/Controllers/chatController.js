import { generateChatResponse } from "../Config/openaiService.js";


// export const chatResponse = async (req, res) => {
//   try {
//     const { message } = req.body;

//     if (!message) {
//       return res.status(400).json({ error: "Message is required" });
//     }

//     const messages = [
//       {
//         role: "system",
//         content: `
//         You are NRITAX AI, a professional NRI tax assistant.
//         Provide clear and structured tax guidance for India.
//         `,
//       },
//       { role: "user", content: message },
//     ];

//     const reply = await generateChatResponse(messages);

//     res.status(200).json({ reply });

//   } catch (error) {
//   if (error.status === 429) {
//     return res.status(429).json({
//       error: "AI quota exceeded. Please check billing."
//     });
//   }

//   console.error("OpenAI Error:", error);
//   res.status(500).json({ error: "Something went wrong" });
// }

// }





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

        if (error.status === 429) {
            return res.status(429).json({
                error: "AI quota exceeded. Please check billing.",
            });
        }

        return res.status(500).json({
            error: "AI service unavailable",
        });
    }
};
