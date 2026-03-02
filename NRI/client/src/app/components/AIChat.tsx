import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Bot, Download, Languages, Send, Shield, Mic, MicOff, Trash2 } from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { TaxReportPDF } from "./TaxReportPDF";
import { buildApiUrl, getSubscriptionStatus } from "../../utils/api";

const getStoredUserName = () => {
  try {
    if (typeof window === "undefined") return "";
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return "";
    const parsedUser = JSON.parse(rawUser);
    return typeof parsedUser?.name === "string" ? parsedUser.name.trim() : "";
  } catch {
    return "";
  }
};

const getWelcomeMessage = (language: string, userName: string) => {
  const safeName = userName || "User";
  const templates: Record<string, string> = {
    english: `Welcome ${safeName}!\n\nHow can I assist you today?`,
    tamil: `வரவேற்கிறேன் ${safeName}!\n\nஇன்று நான் உங்களுக்கு எப்படி உதவலாம்?`,
    hindi: `स्वागत है ${safeName}!\n\nमैं आज आपकी कैसे सहायता कर सकता हूँ?`,
    indonesian: `Selamat datang ${safeName}!\n\nBagaimana saya bisa membantu Anda hari ini?`,
  };
  return templates[language] || templates.english;
};

const hasProSections = (text: string) =>
  /###\s*Pro Answer/i.test(text) && /###\s*Tax Position/i.test(text);

const toProDisplayFormat = (text: string) => {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  if (hasProSections(raw)) return raw;

  return [
    "### Pro Answer",
    raw,
    "",
    "### Tax Position",
    "- Guidance is based on your current question and session context.",
    "- Treaty-specific points should be validated for your resident country.",
    "",
    "### Why This Matters",
    "- Correct NRI tax treatment avoids overpayment and notices.",
    "- Proper documentation helps claim DTAA benefits smoothly.",
    "",
    "### Action Checklist",
    "1. Confirm your residential status for the relevant financial year.",
    "2. Classify income source (salary, interest, rental, capital gains).",
    "3. Check DTAA article mapping and required proofs (TRC, Form 10F, PAN).",
    "",
    "### Caution / When to Consult a CA",
    "- Consult a CA if multi-country income, large capital gains, or treaty conflicts are involved.",
    "",
    "### Starter Questions You Can Ask Next",
    "- Which ITR form should I file as an NRI?",
    "- How is NRE vs NRO interest taxed?",
    "- Which DTAA article applies to my income type?",
  ].join("\n");
};

interface AIChatProps {
  onRequireLogin: () => void;
}

export function AIChat({ onRequireLogin }: AIChatProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const knowledgeSource = "dtaa";
  const [userName, setUserName] = useState(getStoredUserName());
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token"))
  );
  const [subscription, setSubscription] = useState<{ plan?: string; status?: string } | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([
    {
      role: "ai",
      content: getWelcomeMessage("english", getStoredUserName()),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef("");
  const starterQuestionsByLanguage: Record<string, string[]> = {
    english: [
      "What is NRI tax in simple terms?",
      "Do I need to file ITR as an NRI?",
      "How does DTAA reduce double taxation?",
      "Is NRE account interest taxable in India?",
      "How is NRI rental income taxed?",
      "What documents are needed to claim DTAA relief?",
    ],
    hindi: [
      "NRI tax ka matlab kya hai?",
      "Kya NRI ko ITR file karna zaroori hai?",
      "DTAA se double taxation kaise kam hota hai?",
      "Kya NRE account ka interest India me taxable hai?",
      "NRI rental income par tax kaise lagta hai?",
      "DTAA relief ke liye kaunse documents chahiye?",
    ],
    tamil: [
      "NRI tax என்றால் என்ன?",
      "NRI கள் ITR file செய்ய வேண்டுமா?",
      "DTAA இரட்டை வரியை எப்படி குறைக்கிறது?",
      "NRE account interest இந்தியாவில் taxable ஆ?",
      "NRI rental incomeக்கு tax எப்படி?",
      "DTAA relief க்கு எந்த documents வேண்டும்?",
    ],
    indonesian: [
      "Apa itu pajak NRI secara sederhana?",
      "Apakah NRI wajib lapor ITR?",
      "Bagaimana DTAA mengurangi pajak berganda?",
      "Apakah bunga akun NRE kena pajak di India?",
      "Bagaimana pajak penghasilan sewa untuk NRI?",
      "Dokumen apa untuk klaim manfaat DTAA?",
    ],
  };

  const clearChat = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const welcomeMessage = getWelcomeMessage(language, userName);
    if (!token) {
      setMessages([{ role: "ai", content: welcomeMessage }]);
      return;
    }

    try {
      await axios.post(
        buildApiUrl("/api/chat/clear"),
        { language, knowledgeSource },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
    }

    setMessages([{ role: "ai", content: welcomeMessage }]);
  };
  const hasActivePaidSubscription =
    Boolean(subscription?.plan && subscription.plan !== "FREE" && subscription?.status === "active");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const base = baseQuestionRef.current.trim();
      const spoken = transcript.trim();
      setQuestion(base && spoken ? `${base} ${spoken}` : base || spoken);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      return;
    }

    baseQuestionRef.current = question.trim();
    recognition.lang =
      language === "hindi"
        ? "hi-IN"
        : language === "tamil"
        ? "ta-IN"
        : language === "indonesian"
        ? "id-ID"
        : "en-US";
    recognition.start();
  };

  useEffect(() => {
    if (!chatContentRef.current) return;
    const node = chatContentRef.current;
    const id = requestAnimationFrame(() => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isTyping]);

  useEffect(() => {
    const syncAuth = () => {
      setIsAuthenticated(Boolean(localStorage.getItem("token")));
      setUserName(getStoredUserName());
    };
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-changed", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !localStorage.getItem("token")) {
      setSubscription(null);
      return;
    }
    getSubscriptionStatus()
      .then((data: any) => setSubscription(data?.subscription ?? null))
      .catch(() => setSubscription(null));
  }, [isAuthenticated]);

  useEffect(() => {
    const welcomeMessage = getWelcomeMessage(language, userName);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!isAuthenticated || !token) {
      setMessages((prev) => {
        if (!prev.length) return [{ role: "ai", content: welcomeMessage }];
        const [first, ...rest] = prev;
        if (first.role === "ai") return [{ ...first, content: welcomeMessage }, ...rest];
        return [{ role: "ai", content: welcomeMessage }, ...prev];
      });
      return;
    }

    let isCancelled = false;
    const loadHistory = async () => {
      try {
        const response = await axios.get(buildApiUrl("/api/chat/history"), {
          params: { language, knowledgeSource },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isCancelled) return;

        const history = Array.isArray(response.data?.messages) ? response.data.messages : [];
        if (history.length) {
          setMessages(history);
          return;
        }
      } catch {
      }

      if (!isCancelled) {
        setMessages([{ role: "ai", content: welcomeMessage }]);
      }
    };

    void loadHistory();
    return () => {
      isCancelled = true;
    };
  }, [language, userName, isAuthenticated, knowledgeSource]);

  const submitQuestion = async (forcedQuestion?: string) => {
    const effectiveQuestion = typeof forcedQuestion === "string" ? forcedQuestion.trim() : question.trim();
    if (!effectiveQuestion) return;

    if (!isAuthenticated) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Please sign in to use AI Chat." },
      ]);
      onRequireLogin();
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onRequireLogin();
      return;
    }

    const userMessage = effectiveQuestion;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setQuestion("");
    setIsTyping(true);

    try {
      const response = await axios.post(
        buildApiUrl("/api/chat"),
        {
          message: userMessage,
          language,
          knowledgeSource,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const aiReply = response.data.reply;
      setMessages((prev) => [...prev, { role: "ai", content: aiReply }]);
    } catch (error: any) {
      if (error.response?.status === 401) {
        onRequireLogin();
      }
      const errorMessage =
        error.response?.status === 401
          ? "Please sign in again to continue."
          : error.response?.data?.error || "Something went wrong. Please try again.";

      setMessages((prev) => [...prev, { role: "ai", content: errorMessage }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitQuestion();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuestion();
  };

  const handleStarterQuestionSelect = (selectedQuestion: string) => {
    setQuestion(selectedQuestion);
    void submitQuestion(selectedQuestion);
  };

  const latestAIMessage = messages.filter((m) => m.role === "ai").slice(-1)[0]?.content || "";
  const reportData = [
    { label: "Language Selected", value: language },
    { label: "User Query", value: messages.slice(-2)[0]?.content || "-" },
    { label: "AI Response Summary", value: latestAIMessage.substring(0, 300) },
  ];

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="outline">AI-Powered</Badge>
          <h2 className="text-3xl sm:text-4xl mb-4">Chat with AI Tax Assistant</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get instant answers to your NRI tax queries in multiple languages
          </p>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-100">
              <Bot className="size-7 text-blue-600" />
            </div>
            <h3 className="text-2xl mb-2">Login to continue chat</h3>
            <p className="text-gray-600 mb-6">
              Please sign in to use the AI assistant and receive personalized responses.
            </p>
            <Button onClick={onRequireLogin}>Login / Sign Up</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_38%,_#ffffff_100%)] rounded-3xl">
      <div className="text-center mb-12">
        <Badge className="mb-4" variant="outline">AI-Powered</Badge>
        <h2 className="text-3xl sm:text-4xl mb-4">Chat with AI Tax Assistant</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Get instant answers to your NRI tax queries in multiple languages
        </p>
      </div>

      <Card className="max-w-4xl mx-auto h-[72dvh] min-h-[420px] sm:min-h-[520px] max-h-[760px] lg:h-[640px] flex flex-col border border-slate-200 shadow-xl overflow-hidden bg-white/95">
        <CardHeader className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/60 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg border border-blue-200">
                <Bot className="size-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>AI Tax Assistant</CardTitle>
                <CardDescription>Secure, structured tax guidance for NRIs</CardDescription>
              </div>
            </div>

            {hasActivePaidSubscription ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={clearChat}>
                  <Trash2 className="size-4 mr-2" />
                  Clear Chat
                </Button>
                <PDFDownloadLink
                  document={<TaxReportPDF userName="NRITAX User" reportData={reportData} />}
                  fileName="nritax-report.pdf"
                >
                  {({ loading }) => (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">
                      <Download className="size-4 mr-2" />
                      {loading ? "Generating..." : "Download PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={clearChat}>
                  <Trash2 className="size-4 mr-2" />
                  Clear Chat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/pricing")}
                >
                  <Download className="size-4 mr-2" />
                  Subscribe to Download
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4">
            <Languages className="size-4 text-slate-500" />
            <span className="text-sm text-slate-600">Language</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full sm:w-44 bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="hindi">Hindi</SelectItem>
                <SelectItem value="tamil">Tamil</SelectItem>
                <SelectItem value="indonesian">Bahasa Indonesia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
              Starter Questions
            </p>
            <div className="flex flex-wrap gap-2">
              {(starterQuestionsByLanguage[language] || starterQuestionsByLanguage.english).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-1.5 px-2.5 text-xs text-left"
                  onClick={() => handleStarterQuestionSelect(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent
          ref={chatContentRef}
          className="flex-1 overflow-y-auto space-y-5 p-6 bg-[linear-gradient(180deg,#f8fbff_0%,#f6f8fc_48%,#ffffff_100%)]"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[82%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white border border-blue-500 shadow-blue-200"
                    : "bg-white text-slate-900 border border-slate-200 prose prose-sm max-w-none shadow-slate-200"
                }`}
              >
                <p className={`mb-1 text-[11px] uppercase tracking-wide ${message.role === "user" ? "text-blue-100" : "text-slate-500"}`}>
                  {message.role === "user" ? "You" : "NRITAX AI"}
                </p>
                {message.role === "ai" ? (
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="font-bold text-base">{children}</h1>,
                      h2: ({ children }) => <h2 className="font-bold text-[15px]">{children}</h2>,
                      h3: ({ children }) => <h3 className="font-bold text-sm">{children}</h3>,
                      h4: ({ children }) => <h4 className="font-bold text-sm">{children}</h4>,
                      h5: ({ children }) => <h5 className="font-bold text-sm">{children}</h5>,
                      h6: ({ children }) => <h6 className="font-bold text-sm">{children}</h6>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      p: ({ children }) => <p className="mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                    }}
                  >
                    {toProDisplayFormat(message.content)}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">NRITAX AI</p>
                <div className="flex gap-1">
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full flex items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <Textarea
              placeholder="Ask about DTAA, NRI taxes, tax planning..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none min-h-[56px] border-0 bg-transparent focus-visible:ring-0"
              rows={1}
            />
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className="flex-shrink-0 h-10 w-10 rounded-full"
              onClick={toggleVoiceInput}
              disabled={!speechSupported}
              title={speechSupported ? "Voice input" : "Voice input not supported in this browser"}
            >
              {isListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            <Button type="submit" size="icon" className="flex-shrink-0 h-10 w-10 rounded-full">
              <Send className="size-5" />
            </Button>
          </form>
        </CardFooter>
        {isListening && (
          <p className="px-4 pb-4 text-xs text-red-600">Listening... tap mic again to stop.</p>
        )}
      </Card>

      {!hasActivePaidSubscription && (
        <div className="max-w-4xl mx-auto mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Need detailed planning and unlimited AI chat?{" "}
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="font-semibold underline underline-offset-2"
          >
            Explore Plans
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto mt-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm text-gray-600 leading-relaxed">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-4 text-gray-700" />
            <p className="font-semibold text-gray-800">Privacy and Data Protection Notice</p>
          </div>
          <p>
            This chatbot values your privacy and is designed to protect your personal information.
            Any data shared during interactions is used solely to provide accurate and relevant responses.
          </p>
          <p className="mt-2">
            The chatbot does not store, share, or sell personal data to third parties.
            Conversations may be monitored anonymously to improve performance.
          </p>
          <p className="mt-2">
            Please do not share sensitive information such as passwords, financial details, or identification numbers.
          </p>
        </div>
      </div>
    </div>
  );
}



