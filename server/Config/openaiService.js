import dotenv from "dotenv";

dotenv.config();

export const generateChatResponse = async (messages) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nritaxai.vercel.app", // your frontend URL
        "X-Title": "NRITAX AI"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", 
        messages: messages,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenRouter API error");
    }

    return data.choices[0].message.content;

  } catch (error) {
    console.error("OpenRouter Error:", error.message);
    throw error;
  }
};
