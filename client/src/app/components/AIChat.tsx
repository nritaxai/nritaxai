import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Bot, Download, Languages, Send, Shield, Mic, MicOff, Trash2, Square } from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { TaxRuleTimeline, type TaxRuleTimelineItem } from "./TaxRuleTimeline";
import { PdfDownloadButton } from "./PdfDownloadButton";
import { IOS_EXTERNAL_PURCHASES_DISABLED } from "../../config/appConfig";
import { buildApiUrl, clearStoredAuth, getMySubscription } from "../../utils/api";
import { PLAN_KEYS, getRemainingChatLabel, type SubscriptionMe } from "../../utils/subscription";

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
    tamil: `Vanakkam ${safeName}!\n\nIndru naan ungalukku eppadi uthavalam?`,
    hindi: `Namaste ${safeName}!\n\nMain aaj aapki kaise sahayata kar sakta hoon?`,
    indonesian: `Selamat datang ${safeName}!\n\nBagaimana saya bisa membantu Anda hari ini?`,
  };
  return templates[language] || templates.english;
};

const stripBoldMarkers = (text: string) =>
  String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/###\s*Note[\s\S]*?uploaded\s*pdfs?[\s\S]*?(?=\n###\s|\s*$)/im, "")
    .replace(/^\s*Note:\s*.*uploaded\s*pdfs?.*$/gim, "")
    .replace(/^\s*.*uploaded\s*pdfs?.*$/gim, "")
    .replace(/^\s*###\s*Note\s*$/gim, "")
    .replace(/^\s*Note\s*$/gim, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const ensureVisibleReply = (text: string) => {
  const cleaned = stripBoldMarkers(text);
  return cleaned || "No reply was returned. Please try again.";
};

interface AIChatProps {
  onRequireLogin: () => void;
  minimal?: boolean;
}

type ChatMessage = {
  role: "user" | "ai";
  content: string;
  taxRuleTimelines?: TaxRuleTimelineItem[];
};

const normalizeMessage = (message: any): ChatMessage | null => {
  if (!message || typeof message !== "object") return null;
  return {
    role: message.role === "user" ? "user" : "ai",
    content: ensureVisibleReply(message.content),
    taxRuleTimelines: Array.isArray(message.taxRuleTimelines) ? message.taxRuleTimelines : [],
  };
};

export function AIChat({ onRequireLogin, minimal = false }: AIChatProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const knowledgeSource = "dtaa";
  const [userName, setUserName] = useState(getStoredUserName());
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token"))
  );
  const [subscription, setSubscription] = useState<SubscriptionMe | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content: getWelcomeMessage("english", getStoredUserName()),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef("");
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
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
      "NRI tax enraal enna?",
      "NRI-kku ITR file seyyanumaa?",
      "DTAA irattai variyai eppadi kuraikkirathu?",
      "NRE account interest India-vil taxable-aa?",
      "NRI rental income-kku tax eppadi?",
      "DTAA relief-kku enna documents venum?",
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
    Boolean(subscription?.plan && subscription.plan !== PLAN_KEYS.STARTER && subscription?.subscriptionStatus === "active");
  const starterLimitReached =
    subscription?.plan === PLAN_KEYS.STARTER &&
    subscription?.remaining?.chatMessages !== null &&
    Number(subscription?.remaining?.chatMessages || 0) <= 0;

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
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

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
    getMySubscription()
      .then((data: any) => setSubscription(data ?? null))
      .catch((error: any) => {
        setSubscription(null);
        if (error?.response?.status === 401) {
          clearStoredAuth();
          setSessionMessage("Your session expired. Please sign in again.");
        }
      });
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
          setMessages(history.map((item: any) => normalizeMessage(item)).filter(Boolean) as ChatMessage[]);
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
    if (starterLimitReached) {
      setSessionMessage("Free plan limit reached. Upgrade to Professional.");
      return;
    }

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
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    activeRequestControllerRef.current?.abort();
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
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
          signal: controller.signal,
        }
      );

      if (activeRequestIdRef.current !== requestId) return;
      if (response.data?.usage) {
        setSubscription(response.data.usage);
      }
      const aiReply = ensureVisibleReply(response.data.reply);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: aiReply,
          taxRuleTimelines: Array.isArray(response.data?.taxRuleTimelines) ? response.data.taxRuleTimelines : [],
        },
      ]);
    } catch (error: any) {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
        return;
      }
      if (activeRequestIdRef.current !== requestId) return;
      if (error.response?.status === 403 && error.response?.data?.usage) {
        setSubscription(error.response.data.usage);
        setSessionMessage(error.response?.data?.error || "Free plan limit reached. Upgrade to Professional.");
        return;
      }
      if (error.response?.status === 401) {
        clearStoredAuth();
        setSessionMessage("Your session expired. Please sign in again.");
        onRequireLogin();
      }
      const errorMessage =
        error.response?.status === 401
          ? "Please sign in again to continue."
          : error.response?.data?.error || "Something went wrong. Please try again.";

      setMessages((prev) => [...prev, { role: "ai", content: ensureVisibleReply(errorMessage), taxRuleTimelines: [] }]);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestControllerRef.current = null;
        setIsTyping(false);
      }
    }
  };

  const handleStopResponse = () => {
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = null;
    activeRequestIdRef.current += 1;
    setIsTyping(false);
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
  const reportData = {
    userName: userName || "",
    fileName: "nritax-report.pdf",
    taxpayerInfo: [
      { label: "Language Selected", value: language },
      { label: "Generated For", value: userName || "Not provided" },
    ],
    incomeSummary: [{ label: "User Query", value: messages.slice(-2)[0]?.content || "-" }],
    deductions: [],
    taxCalculation: [{ label: "AI Response Summary", value: latestAIMessage.substring(0, 300) || "-" }],
    reportData: [
      { label: "Language Selected", value: language },
      { label: "User Query", value: messages.slice(-2)[0]?.content || "-" },
      { label: "AI Response Summary", value: latestAIMessage.substring(0, 300) || "-" },
    ],
  };

  return (
    <div className={`mx-auto w-full ${minimal ? "h-full min-h-0 max-w-none" : "max-w-5xl"}`}>
      <Card
        className={`glass-panel flex w-full flex-col overflow-hidden ${
          minimal
            ? "h-full rounded-none border-0 shadow-none"
            : "mt-3 h-[100dvh] min-h-[100dvh] max-h-[100dvh] border border-[#E2E8F0] shadow-xl md:h-[78dvh] md:min-h-0 md:max-h-[760px]"
        }`}
      >
        {!minimal ? (
        <CardHeader className="flex-shrink-0 border-b border-[#E2E8F0]/80 bg-[linear-gradient(135deg,rgba(255,245,252,0.88),rgba(236,246,255,0.86))] backdrop-blur-md p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2563eb]/12 rounded-lg border border-[#2563eb]/40 shadow-sm">
                <Bot className="size-6 text-[#2563eb]" />
              </div>
              <div>
                <CardTitle>AI Chat Assistant</CardTitle>
                <CardDescription className="text-[#0F172A]">Secure guidance for NRI taxes</CardDescription>
              </div>
            </div>

            {!isAuthenticated ? (
              <Button size="sm" onClick={onRequireLogin}>
                Login / Sign Up
              </Button>
            ) : hasActivePaidSubscription ? (
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={clearChat}>
                  <Trash2 className="size-4 mr-2" />
                  Clear Chat
                </Button>
                <PdfDownloadButton reportData={reportData} onRequireLogin={onRequireLogin} />
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
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
                  {IOS_EXTERNAL_PURCHASES_DISABLED ? "View Plan Access" : "Subscribe to Download"}
                </Button>
              </div>
            )}
          </div>
          {sessionMessage ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {sessionMessage}
            </p>
          ) : null}
          {subscription ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-white/70 text-[#0F172A]">Current Plan: {subscription.currentPlan?.displayName || "Starter"}</Badge>
              <Badge className="bg-white/70 text-[#0F172A]">{getRemainingChatLabel(subscription)}</Badge>
            </div>
          ) : null}

          {isAuthenticated && (
          <div className="flex flex-col md:flex-row md:items-center gap-2 mt-4">
            <Languages className="size-4 text-[#0F172A]" />
            <span className="text-sm text-[#0F172A]">Language</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full md:w-44 bg-[#F7FAFC]/90 border-[#E2E8F0]">
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
          )}

          {isAuthenticated && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#0F172A] mb-2">
              Starter Questions
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {(starterQuestionsByLanguage[language] || starterQuestionsByLanguage.english).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-1.5 px-2.5 text-xs text-left whitespace-nowrap shrink-0"
                  onClick={() => handleStarterQuestionSelect(item)}
                  disabled={starterLimitReached}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
          )}
        </CardHeader>
        ) : null}

        {!isAuthenticated ? (
          <CardContent className="flex-1 py-10 px-6 text-center bg-[linear-gradient(180deg,rgba(25,17,39,0.72)_0%,rgba(20,14,34,0.65)_48%,rgba(16,11,27,0.76)_100%)]">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#2563eb]/12">
              <Bot className="size-7 text-[#2563eb]" />
            </div>
            <h3 className="text-xl text-[#0F172A] mb-2">Login to continue chat</h3>
            <p className="text-[#0F172A] mb-6">
              Sign in to use AI assistant and get personalized responses.
            </p>
            <Button onClick={onRequireLogin}>Login / Sign Up</Button>
          </CardContent>
        ) : (
        <>
        <CardContent
          ref={chatContentRef}
          // Let only the transcript pane scroll so the composer stays visible as the viewport resizes.
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 p-4 [WebkitOverflowScrolling:touch] ${
            minimal
              ? "bg-white"
              : "bg-[linear-gradient(180deg,rgba(25,17,39,0.72)_0%,rgba(20,14,34,0.65)_48%,rgba(16,11,27,0.76)_100%)]"
          }`}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "ai" && (
                <div className="size-8 shrink-0 rounded-full border border-[#2563eb]/40 bg-[#F7FAFC]/90 text-[#2563eb] flex items-center justify-center text-[10px] font-semibold">
                  AI
                </div>
              )}
              <div
                className={`max-w-[94%] sm:max-w-[82%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md transition-all duration-200 ${
                  message.role === "user"
                    ? "bg-[#2563eb] text-[#0F172A] border border-[#2563eb]/40"
                    : "bg-[#F7FAFC]/95 text-[#0F172A] border border-[#E2E8F0]/80 prose prose-sm max-w-none"
                }`}
              >
                {message.role === "ai" ? (
                  <div>
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
                      {ensureVisibleReply(message.content)}
                    </ReactMarkdown>
                    <TaxRuleTimeline timelines={message.taxRuleTimelines} compact />
                  </div>
                ) : (
                  message.content
                )}
              </div>
              {message.role === "user" && (
                <div className="size-8 shrink-0 rounded-full border border-[#2563eb]/40 bg-[#F7FAFC]/95 text-[#2563eb] flex items-center justify-center text-[10px] font-semibold">
                  You
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start items-end gap-2">
              <div className="size-8 shrink-0 rounded-full border border-[#2563eb]/40 bg-[#F7FAFC]/90 text-[#2563eb] flex items-center justify-center text-[10px] font-semibold">
                AI
              </div>
              <div className="rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(226,232,240,0.92))] px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-6px_14px_rgba(148,163,184,0.18)] backdrop-blur-md">
                <p className="text-sm font-black tracking-[0.18em] text-[#0F172A] [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_10px_20px_rgba(148,163,184,0.45)]">
                  <span className="blur-[0.2px]">Thinking.....</span>
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter
          // Safe-area-aware sticky positioning keeps the composer above mobile browser chrome and Android nav bars.
          className="sticky bottom-0 z-10 w-full flex-shrink-0 border-t border-[#E2E8F0]/80 bg-[rgba(255,255,255,0.9)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full flex items-end gap-2 sm:gap-3 rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/80 p-2.5 sm:p-3"
          >
            <Textarea
              placeholder="Ask about DTAA, NRI taxes, tax planning..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none min-h-[52px] max-h-40 border-0 bg-transparent focus-visible:ring-0 text-[#0F172A] placeholder:text-[#0F172A]"
              rows={1}
              disabled={starterLimitReached}
            />
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className="flex-shrink-0 h-10 w-10 rounded-full"
              onClick={toggleVoiceInput}
              disabled={!speechSupported || starterLimitReached}
              title={speechSupported ? "Voice input" : "Voice input not supported in this browser"}
            >
              {isListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            {isTyping ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="flex-shrink-0 h-10 w-10 rounded-full border-[#0F172A]"
                onClick={handleStopResponse}
                title="Interrupt response"
              >
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="flex-shrink-0 h-10 w-10 rounded-full" disabled={starterLimitReached}>
                <Send className="size-5" />
              </Button>
            )}
          </form>
          {starterLimitReached ? (
            <p className="mt-2 text-sm text-amber-900">
              {IOS_EXTERNAL_PURCHASES_DISABLED
                ? "Free plan limit reached. Paid upgrades are not available inside this iOS build yet."
                : "Free plan limit reached. Upgrade to Professional."}
            </p>
          ) : null}
        </CardFooter>
        {isListening && !minimal && (
          <p className="px-4 pb-4 text-xs text-red-600">Listening... tap mic again to stop.</p>
        )}
        </>
        )}
      </Card>
      {!minimal && isAuthenticated && !hasActivePaidSubscription && (
        <div className="mt-2 w-full rounded-lg border border-[#2563eb]/40 bg-[#2563eb]/12 p-3 text-xs text-[#0F172A]">
          {IOS_EXTERNAL_PURCHASES_DISABLED ? "Need expert support?" : "Need expert support?"}{" "}
          <button type="button" onClick={() => navigate("/pricing")} className="font-semibold underline underline-offset-2">
            {IOS_EXTERNAL_PURCHASES_DISABLED ? "View access options" : "View plans"}
          </button>
        </div>
      )}
      {!minimal ? (
      <div className="mt-2 w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 text-xs text-[#0F172A] leading-relaxed">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-4 text-[#0F172A]" />
            <p className="font-semibold text-[#E2E8F0]">Privacy and Data Protection Notice</p>
          </div>
          <p>
            This chatbot values your privacy and is designed to protect your personal information.
            Any data shared during interactions is used solely to provide accurate and relevant responses.
          </p>
          <p className="mt-2">
            Chat prompts may be processed by secure third-party AI infrastructure to generate responses.
            Conversations may be monitored or logged in a limited way to improve reliability and performance.
          </p>
          <p className="mt-2">
            Please do not share sensitive information such as passwords, financial details, or identification numbers.
          </p>
        </div>
      ) : null}
    </div>
  );
}

















