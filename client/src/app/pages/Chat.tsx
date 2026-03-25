import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { AIChat } from "../components/AIChat";
import { AuthGateCard } from "../components/AuthGateCard";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Bot, Languages, Mic, MicOff, Send, Sparkles, Trash2, Download, Square } from "lucide-react";
import { buildApiUrl, clearStoredAuth, getStoredAuthToken, getSubscriptionStatus } from "../../utils/api";

interface ChatProps {
  onRequireLogin: () => void;
}

const GUEST_SESSION_STORAGE_KEY = "nritax_guest_chat_session";
const CHAT_GUEST_HEADER = "x-guest-session-id";

const createGuestSessionId = () =>
  `guest-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const getGuestSessionId = () => {
  if (typeof window === "undefined") return "guest-browser";
  const existing = localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const nextValue = createGuestSessionId();
  localStorage.setItem(GUEST_SESSION_STORAGE_KEY, nextValue);
  return nextValue;
};

const getChatRequestHeaders = () => {
  const headers: Record<string, string> = {
    [CHAT_GUEST_HEADER]: getGuestSessionId(),
  };
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

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

const fallbackReplyByLanguage: Record<string, string> = {
  english:
    "### Answer\nI am temporarily unable to access live AI services.\n\n### Key Tax Points\n- Your chat request was received.\n- You can still proceed with general NRI tax planning steps.\n- For urgent cases, consult a CPA.\n\n### Next Steps\n- Re-try your question in 1-2 minutes.\n- If it persists, use CPA Consultation.\n\n### Follow-up Questions\n- Which NRI tax topic should we prioritize?\n- Do you want a checklist for DTAA documents?",
  hindi:
    "### Answer\nMain filhaal live AI services access nahi kar paa raha hoon.\n\n### Key Tax Points\n- Aapka chat request receive ho gaya hai.\n- Aap general NRI tax planning steps continue kar sakte hain.\n- Urgent case mein CPA se consult karein.\n\n### Next Steps\n- 1-2 minute baad apna question dobara bhejein.\n- Agar issue continue ho, to CPA Consultation use karein.\n\n### Follow-up Questions\n- Kaunsa NRI tax topic hum pehle cover karein?\n- Kya aapko DTAA documents ka checklist chahiye?",
  tamil:
    "### Answer\nNaan ippo live AI services-ai access panna mudiyala.\n\n### Key Tax Points\n- Ungal chat request receive aagiduchu.\n- Neenga general NRI tax planning steps continue panna mudiyum.\n- Urgent case-na CPA kitta consult pannunga.\n\n### Next Steps\n- 1-2 nimidam kazhichu unga kelviya thirumba anuppunga.\n- Issue continue aana CPA Consultation use pannunga.\n\n### Follow-up Questions\n- Endha NRI tax topic-ah first priority kudukkanum?\n- Ungalukku DTAA documents checklist venuma?",
  indonesian:
    "### Answer\nLayanan AI langsung sedang tidak tersedia sementara.\n\n### Key Tax Points\n- Pertanyaan Anda sudah diterima.\n- Anda tetap bisa lanjut dengan langkah perencanaan pajak NRI umum.\n- Untuk kasus mendesak, konsultasikan ke CPA.\n\n### Next Steps\n- Coba kirim ulang pertanyaan dalam 1-2 menit.\n- Jika tetap terjadi, gunakan CPA Consultation.\n\n### Follow-up Questions\n- Topik pajak NRI mana yang ingin diprioritaskan?\n- Apakah Anda ingin checklist dokumen DTAA?",
};

const normalizeMessage = (message: unknown): { role: "user" | "ai"; content: string } | null => {
  if (!message || typeof message !== "object") return null;
  const role = (message as { role?: string }).role === "user" ? "user" : "ai";
  const content = ensureVisibleReply((message as { content?: unknown }).content as string);
  return { role, content };
};

export function Chat({ onRequireLogin }: ChatProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState(getStoredUserName());
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const knowledgeSource = "dtaa";
  const [subscription, setSubscription] = useState<{ plan?: string; status?: string } | null>(null);
  const welcomeByLanguage: Record<string, string> = {
    english: `Hi${userName ? ` ${userName}` : ""}! I am YUKTI, your AI chat assistant. I can help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?`,
    tamil: `Vanakkam${userName ? ` ${userName}` : ""}! Naan YUKTI, ungal AI chat assistant. DTAA vidhigal, NRI vari kelvigal, matrum vari thittamidhalil naan uthava tayaaraga irukkiren. Indru naan ungalukku eppadi uthavalam?`,
    hindi: `Namaste${userName ? ` ${userName}` : ""}! Main YUKTI, aapka AI chat assistant hoon. DTAA niyamon, NRI tax prashnon, aur tax planning mein main aapki madad kar sakta hoon. Main aaj aapki kaise sahayata kar sakta hoon?`,
    indonesian: `Halo${userName ? ` ${userName}` : ""}! Saya YUKTI, asisten chat AI Anda. Saya siap membantu Anda terkait regulasi DTAA, pertanyaan pajak NRI, dan perencanaan pajak. Bagaimana saya bisa membantu Anda hari ini?`,
  };
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([
    {
      role: "ai",
      content: welcomeByLanguage.english
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [providerWarning, setProviderWarning] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef("");
  const starterMessageHandledRef = useRef(false);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);

  const getWelcomeMessage = () => welcomeByLanguage[language] || welcomeByLanguage.english;

  const downloadChatTranscript = () => {
    if (!messages.length) return;

    const timestamp = new Date();
    const safeStamp = timestamp.toISOString().replace(/[:.]/g, "-");
    const transcript =
      `NRITAX Chat Transcript\nGenerated: ${timestamp.toLocaleString()}\nLanguage: ${language}\n\n` +
      messages
        .map((msg) => `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`)
        .join("\n\n");

    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nritax-chat-${safeStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearChat = async () => {
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = null;
    setIsTyping(false);

    const welcomeMessage = getWelcomeMessage();

    try {
      await axios.post(
        buildApiUrl("/api/chat/clear"),
        { language, knowledgeSource },
        { headers: getChatRequestHeaders() }
      );
    } catch {
    }

    setMessages([{ role: "ai", content: welcomeMessage }]);
  };
  const renderAiMessage = (content: string) => {
    const lines = stripBoldMarkers(content).split("\n");
    return (
      <div className="space-y-1">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          const markdownHeadingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
          const numberedHeadingMatch = trimmed.match(/^\d+[).]\s+(.*)$/);
          const boldHeadingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
          const labelHeadingMatch = trimmed.match(
            /^(short answer|key points|important highlights|important points|next steps)\b[:\-]?\s*(.*)$/i
          );

          const headingText =
            markdownHeadingMatch?.[1] ??
            numberedHeadingMatch?.[1] ??
            boldHeadingMatch?.[1] ??
            labelHeadingMatch?.[0];

          const isHeading = Boolean(headingText);

          if (!trimmed) return <div key={index} className="h-2" />;

          if (isHeading) {
            return (
              <p key={index} className="font-bold">
                <strong style={{ fontWeight: 700 }}>{headingText}</strong>
              </p>
            );
          }

          return (
            <p key={index}>
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  const isAuthenticated = Boolean(typeof window !== "undefined" && getStoredAuthToken());
  const hasActivePaidSubscription =
    Boolean(subscription?.plan && subscription.plan !== "FREE" && subscription?.status === "active");

  useEffect(() => {
    const syncUser = () => setUserName(getStoredUserName());
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-changed", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-changed", syncUser);
    };
  }, []);

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

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
    if (!isAuthenticated || !localStorage.getItem("token")) {
      setSubscription(null);
      return;
    }
    getSubscriptionStatus()
      .then((data: any) => setSubscription(data?.subscription ?? null))
      .catch((error: any) => {
        setSubscription(null);
        if (error?.response?.status === 401) {
          clearStoredAuth();
          setSessionMessage("Your session expired. Please sign in again.");
        }
      });
  }, [isAuthenticated]);

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
    if (!isAuthenticated) {
      setMessages([{ role: "ai", content: getWelcomeMessage() }]);
      return;
    }

    const welcomeMessage = getWelcomeMessage();

    let isCancelled = false;
    const loadHistory = async () => {
      try {
        const response = await axios.get(buildApiUrl("/api/chat/history"), {
          params: { language, knowledgeSource },
          headers: getChatRequestHeaders(),
        });

        if (isCancelled) return;
        const history = Array.isArray(response.data?.messages) ? response.data.messages : [];
        if (history.length) {
          const normalizedHistory = history
            .map((item: unknown) => normalizeMessage(item))
            .filter(Boolean) as Array<{ role: "user" | "ai"; content: string }>;
          setMessages(normalizedHistory.length ? normalizedHistory : [{ role: "ai", content: welcomeMessage }]);
          return;
        }
      } catch {
        setProviderWarning("");
      }

      if (!isCancelled) {
        setMessages([{ role: "ai", content: welcomeMessage }]);
      }
    };

    void loadHistory();
    return () => {
      isCancelled = true;
    };
  }, [language, knowledgeSource, userName]);

  const submitQuestion = async (forcedQuestion?: string) => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    const effectiveQuestion = typeof forcedQuestion === "string" ? forcedQuestion.trim() : question.trim();
    if (!effectiveQuestion) return;

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
        { message: userMessage, language, knowledgeSource },
        { headers: getChatRequestHeaders(), signal: controller.signal }
      );
      if (activeRequestIdRef.current !== requestId) return;
      setProviderWarning("");

      setMessages((prev) => [
        ...prev,
        { role: "ai", content: ensureVisibleReply(response.data.reply) },
      ]);
    } catch (error: any) {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
        return;
      }
      if (activeRequestIdRef.current !== requestId) return;
      if (error.response?.status === 401) {
        clearStoredAuth();
        setSessionMessage("Your session expired. Please sign in again.");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: ensureVisibleReply(
            fallbackReplyByLanguage[language] ||
              fallbackReplyByLanguage.english
          ),
        },
      ]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuestion();
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  const handleStarterQuestionSelect = (selectedQuestion: string) => {
    setQuestion(selectedQuestion);
    requestAnimationFrame(() => {
      questionInputRef.current?.focus();
    });
    void submitQuestion(selectedQuestion);
  };

  const handleOpenPopup = () => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    setIsPopupOpen(true);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (starterMessageHandledRef.current) return;
    const starterMessage = location.state && typeof location.state === "object"
      ? (location.state as { starterMessage?: unknown }).starterMessage
      : undefined;

    if (typeof starterMessage !== "string" || !starterMessage.trim()) return;

    starterMessageHandledRef.current = true;
    setQuestion(starterMessage);
    void submitQuestion(starterMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Login to use AI Tax Chat"
        description="Please sign in to access AI chat, ask tax questions, and save your conversation history."
        onRequireLogin={onRequireLogin}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/82">
        <CardHeader className="pb-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#CBD5E1] bg-[#E2E8F0] px-4 py-2 text-[#0F172A]">
            <Sparkles className="size-4" />
            <span className="text-sm">YUKTI</span>
          </div>
          <h1 className="mb-2 text-3xl text-[#0F172A] sm:text-4xl">AI Tax Chat</h1>
          <p className="max-w-2xl text-base text-[#0F172A]">
            Get instant, intelligent answers to all your NRI tax questions
          </p>
        </CardHeader>
      </Card>
      </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
          }}
          className="grid gap-4 xl:grid-cols-3"
        >
          <motion.div
            className="xl:col-span-2"
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.98 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="flex h-[78dvh] min-h-[460px] max-h-[820px] flex-col rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/82">
              <CardHeader className="flex-shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-[#CBD5E1] bg-[#E2E8F0] p-2">
                      <Bot className="size-6 text-[#0F172A]" />
                    </div>
                    <div>
                      <CardTitle className="text-[#0F172A]">YUKTI</CardTitle>
                      <CardDescription className="text-[#0F172A]">
                        {userName ? `Hi ${userName}` : "Hi"} - Ask anything about NRI taxes and DTAA
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border border-[#CBD5E1] bg-[#E2E8F0] text-[#0F172A]">
                      <span className={`mr-2 size-2 rounded-full ${isTyping ? "animate-pulse bg-amber-500" : "animate-pulse bg-green-600"}`}></span>
                      {isTyping ? "Generating" : "Ready"}
                    </Badge>
                  </div>
                </div>
                {providerWarning ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {providerWarning}
                  </p>
                ) : null}
                {sessionMessage ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {sessionMessage}
                  </p>
                ) : null}
                
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Languages className="size-4 text-[#0F172A]" />
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full border-[#E2E8F0] bg-[#F7FAFC]/85 sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                      <SelectItem value="tamil">Tamil</SelectItem>
                      <SelectItem value="indonesian">Bahasa Indonesia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-[#E2E8F0] text-[#0F172A] sm:ml-auto sm:w-auto"
                    onClick={downloadChatTranscript}
                  >
                    <Download className="size-4 mr-2" />
                    Download Chat
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="w-full border-[#E2E8F0] text-[#0F172A] sm:w-auto" onClick={clearChat}>
                    <Trash2 className="size-4 mr-2" />
                    Clear Chat
                  </Button>
                </div>
              </CardHeader>

              <CardContent ref={chatContentRef} className="flex-1 space-y-4 overflow-y-auto px-3 sm:px-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] break-words rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                        message.role === "user"
                          ? "bg-[#2563eb] text-[#0F172A]"
                          : "border border-[#E2E8F0] bg-[#F7FAFC]/90 text-[#0F172A]"
                      }`}
                    >
                      {message.role === "ai" ? renderAiMessage(message.content) : message.content}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(226,232,240,0.92))] px-4 py-3 text-sm font-black tracking-[0.18em] text-[#0F172A] shadow-[0_18px_40px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-6px_14px_rgba(148,163,184,0.18)] backdrop-blur-md [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_10px_20px_rgba(148,163,184,0.45)]">
                      <span className="blur-[0.2px]">Thinking.....</span>
                    </div>
                  </div>
                )}

              </CardContent>

              <CardFooter className="sticky bottom-0 flex-shrink-0 border-t border-[#E2E8F0] bg-[#1d4ed8]/92 backdrop-blur">
                <form onSubmit={handleSubmit} className="w-full flex items-end gap-2">
                  <Textarea
                    ref={questionInputRef}
                    placeholder="Click here to open AI chat"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    onClick={handleOpenPopup}
                    onFocus={handleOpenPopup}
                    readOnly
                    className="min-h-[44px] max-h-32 resize-none border-[#E2E8F0] bg-[#F7FAFC]/90"
                    rows={1}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    className="h-10 w-10 flex-shrink-0 border-[#E2E8F0]"
                    onClick={toggleVoiceInput}
                    disabled={!speechSupported}
                    title={speechSupported ? "Voice input" : "Voice input not supported in this browser"}
                  >
                    {isListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </Button>
                  {isTyping ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 flex-shrink-0 border-[#E2E8F0] bg-[#F7FAFC]/90"
                      onClick={handleStopResponse}
                      title="Interrupt response"
                    >
                      <Square className="size-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 flex-shrink-0 bg-[#2563eb] text-[#0F172A] hover:opacity-95"
                    >
                      <Send className="size-5" />
                    </Button>
                  )}
                </form>
              </CardFooter>
              {isListening && (
                <p className="px-6 pb-4 text-xs text-red-600">Listening... tap mic again to stop.</p>
              )}
            </Card>
          </motion.div>

          <motion.div
            className="space-y-4"
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.98 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Starter Questions</CardTitle>
                <CardDescription>Click to ask YUKTI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "What is DTAA and how does it help NRIs?",
                  "Do I need to file ITR as an NRI?",
                  "How to claim India-USA DTAA benefits?",
                  "What's the difference between NRO and NRE accounts?",
                  "How is rental income taxed for NRIs?",
                  "What documents do I need for Tax Residency Certificate?"
                ].map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full text-left justify-start h-auto py-2 px-3"
                    onClick={() => handleStarterQuestionSelect(q)}
                  >
                    <span className="text-sm">{q}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
            {!hasActivePaidSubscription && (
              <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/80">
                <CardHeader>
                  <CardTitle className="text-lg text-[#0F172A]">Need expert-level support?</CardTitle>
                  <CardDescription className="text-[#0F172A]">
                    Upgrade for deeper guidance and uninterrupted chat access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    className="w-full bg-[#2563eb] text-[#0F172A] hover:opacity-95"
                    onClick={() => navigate("/pricing")}
                  >
                    View Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </motion.div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC]/80 p-4 text-sm leading-6 text-[#0F172A]">
          <p>
            <strong>Disclaimer:</strong> This chatbot values your privacy and is designed to protect your personal
            information. Any data shared during interactions is used solely to provide accurate and relevant
            responses. The chatbot does not store, share, or sell personal data to third parties. Conversations may
            be monitored anonymously to improve performance and user experience. Do not share sensitive information
            such as passwords, financial details, or identification numbers. By continuing to use this chatbot, you
            acknowledge and accept this notice.
          </p>
        </div>

        <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
          <DialogContent className="max-h-[94vh] max-w-[min(1200px,96vw)] overflow-hidden border border-[#E2E8F0] bg-white p-0 shadow-2xl">
            <DialogTitle className="sr-only">AI Chat Popup</DialogTitle>
            <div className="max-h-[94vh] overflow-auto rounded-2xl bg-white p-2">
              <AIChat onRequireLogin={onRequireLogin} />
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
