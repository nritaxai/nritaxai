import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Bot, Send, Languages } from "lucide-react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export function AIChat() {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([
    {
      role: "ai",
      content: "Hello! I'm your AI tax assistant. I can help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMessage = question;

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setQuestion("");
    setIsTyping(true);

    try {
      const response = await axios.post(`${API}/api/chat`, {
        messages: userMessage,
      });

      const aiReply = response.data.reply;

      setMessages(prev => [
        ...prev,
        { role: "ai", content: aiReply },
      ]);

    } catch (error: any) {
      console.error(error);

      const errorMessage =
        error.response?.data?.error || "Something went wrong";

      setMessages(prev => [
        ...prev,
        { role: "ai", content: errorMessage },
      ]);
    } finally {
      setIsTyping(false);
    }
  };


  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!question.trim()) return;

  //   const userMessage = question;

  //   setMessages(prev => [...prev, { role: "user", content: userMessage }]);
  //   setQuestion("");
  //   setIsTyping(true);


  //   try {
  //     const response = await axios.post(`${API}/api/chat`,
  //       {
  //         messages: [
  //           {
  //             role: "system",
  //             content:
  //               "You are NRITAX AI, a professional NRI tax assistant. Provide clear, structured, India-focused tax guidance.",
  //           },
  //           ...messages.map((msg) => ({
  //             role: msg.role === "ai" ? "assistant" : "user",
  //             content: msg.content,
  //           })),
  //           {
  //             role: "user",
  //             content: userMessage,
  //           },
  //         ],
  //       }
  //     );

  //     const aiReply = response.data.reply;

  //     setMessages((prev) => [
  //       ...prev,
  //       { role: "ai", content: aiReply },
  //     ]);

  //   } catch (error: any) {
  //     console.error(error);

  //     const errorMessage =
  //       error.response?.data?.error || "Something went wrong";

  //     setMessages((prev) => [
  //       ...prev,
  //       { role: "ai", content: errorMessage },
  //     ]);
  //   }
  //   finally {
  //     setIsTyping(false);
  //   }
  // };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <Badge className="mb-4" variant="outline">AI-Powered</Badge>
        <h2 className="text-3xl sm:text-4xl mb-4">Chat with AI Tax Assistant</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Get instant answers to your NRI tax queries in multiple languages
        </p>
      </div>

      <Card className="max-w-4xl mx-auto h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bot className="size-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>AI Tax Assistant</CardTitle>
                <CardDescription>Get instant answers to your tax queries</CardDescription>
              </div>
            </div>
            <Badge variant="secondary">
              <span className="size-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Online
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Languages className="size-4 text-gray-500" />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="hindi">हिन्दी</SelectItem>
                <SelectItem value="tamil">தமிழ்</SelectItem>
                <SelectItem value="gujarati">ગુજરાતી</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
                  }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-shrink-0">
          <form onSubmit={handleSubmit} className="w-full flex gap-2">
            <Textarea
              placeholder="Ask about DTAA, NRI taxes, tax planning..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="resize-none"
              rows={2}
            />
            <Button type="submit" size="icon" className="flex-shrink-0 h-auto">
              <Send className="size-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}