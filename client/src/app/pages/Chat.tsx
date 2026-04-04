import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { AIChat } from "../components/AIChat";
import { AuthGateCard } from "../components/AuthGateCard";
import { TaxRuleTimeline, type TaxRuleTimelineItem } from "../components/TaxRuleTimeline";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Bot, Languages, Mic, MicOff, Send, Sparkles, Trash2, Download, Square, X } from "lucide-react";
import { buildApiUrl, clearStoredAuth, getMySubscription, getStoredAuthToken } from "../../utils/api";
import { PLAN_KEYS, getRemainingChatLabel, type SubscriptionMe } from "../../utils/subscription";

interface ChatProps {
  onRequireLogin: () => void;
}

type PopupBounds = {
  width: number;
  height: number;
  x: number;
  y: number;
};

type ResizeDirection = "left" | "right" | "bottom" | "bottom-left" | "bottom-right" | null;

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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDefaultPopupBounds = (): PopupBounds => {
  if (typeof window === "undefined") {
    return { width: 920, height: 680, x: 24, y: 24 };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = clamp(Math.min(960, viewportWidth - 40), 420, Math.max(420, viewportWidth - 24));
  const height = clamp(Math.min(720, viewportHeight - 40), 360, Math.max(360, viewportHeight - 24));

  return {
    width,
    height,
    x: Math.max(12, Math.round((viewportWidth - width) / 2)),
    y: Math.max(12, Math.round((viewportHeight - height) / 2)),
  };
};

const getClampedPopupBounds = (bounds: PopupBounds): PopupBounds => {
  if (typeof window === "undefined") return bounds;

  const width = clamp(bounds.width, 420, Math.max(420, window.innerWidth - 16));
  const height = clamp(bounds.height, 360, Math.max(360, window.innerHeight - 16));

  return {
    width,
    height,
    x: clamp(bounds.x, 8, Math.max(8, window.innerWidth - width - 8)),
    y: clamp(bounds.y, 8, Math.max(8, window.innerHeight - height - 8)),
  };
};

const getViewportPopupBounds = (): PopupBounds => {
  if (typeof window === "undefined") {
    return { width: 920, height: 680, x: 24, y: 24 };
  }

  return {
    width: Math.max(320, window.innerWidth - 24),
    height: Math.max(320, window.innerHeight - 24),
    x: 12,
    y: 12,
  };
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

type ChatMessage = {
  role: "user" | "ai";
  content: string;
  taxRuleTimelines?: TaxRuleTimelineItem[];
};

const normalizeMessage = (message: unknown): ChatMessage | null => {
  if (!message || typeof message !== "object") return null;
  const role = (message as { role?: string }).role === "user" ? "user" : "ai";
  const content = ensureVisibleReply((message as { content?: unknown }).content as string);
  const taxRuleTimelines = Array.isArray((message as { taxRuleTimelines?: unknown }).taxRuleTimelines)
    ? ((message as { taxRuleTimelines?: TaxRuleTimelineItem[] }).taxRuleTimelines as TaxRuleTimelineItem[])
    : [];
  return { role, content, taxRuleTimelines };
};

export function Chat({ onRequireLogin }: ChatProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState(getStoredUserName());
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const knowledgeSource = "dtaa";
  const [subscription, setSubscription] = useState<SubscriptionMe | null>(null);
  const welcomeByLanguage: Record<string, string> = {
    english: `Hi${userName ? ` ${userName}` : ""}! I am your AI chat assistant. I can help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?`,
    tamil: `Vanakkam${userName ? ` ${userName}` : ""}! Naan ungal AI chat assistant. DTAA vidhigal, NRI vari kelvigal, matrum vari thittamidhalil naan uthava tayaaraga irukkiren. Indru naan ungalukku eppadi uthavalam?`,
    hindi: `Namaste${userName ? ` ${userName}` : ""}! Main aapka AI chat assistant hoon. DTAA niyamon, NRI tax prashnon, aur tax planning mein main aapki madad kar sakta hoon. Main aaj aapki kaise sahayata kar sakta hoon?`,
    indonesian: `Halo${userName ? ` ${userName}` : ""}! Saya asisten chat AI Anda. Saya siap membantu Anda terkait regulasi DTAA, pertanyaan pajak NRI, dan perencanaan pajak. Bagaimana saya bisa membantu Anda hari ini?`,
  };
  const [messages, setMessages] = useState<ChatMessage[]>([
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
  const [popupBounds, setPopupBounds] = useState<PopupBounds>(getDefaultPopupBounds);
  const [isPopupExpanded, setIsPopupExpanded] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(
    typeof window === "undefined" ? false : window.innerWidth < 1024
  );
  const chatContentRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef("");
  const starterMessageHandledRef = useRef(false);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const popupPanelRef = useRef<HTMLDivElement>(null);
  const popupDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const popupResizeRef = useRef<{
    direction: Exclude<ResizeDirection, null>;
    startX: number;
    startY: number;
    startBounds: PopupBounds;
  } | null>(null);

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
  const isAuthenticated = Boolean(typeof window !== "undefined" && getStoredAuthToken());
  const hasActivePaidSubscription =
    Boolean(subscription?.plan && subscription.plan !== PLAN_KEYS.STARTER && subscription?.subscriptionStatus === "active");
  const starterLimitReached =
    subscription?.plan === PLAN_KEYS.STARTER &&
    subscription?.remaining?.chatMessages !== null &&
    Number(subscription?.remaining?.chatMessages || 0) <= 0;

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
          setMessages(normalizedHistory.length ? normalizedHistory : [{ role: "ai", content: welcomeMessage, taxRuleTimelines: [] }]);
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
    if (starterLimitReached) {
      setProviderWarning("Free plan limit reached. Upgrade to Professional.");
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
      if (response.data?.usage) {
        setSubscription(response.data.usage);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: ensureVisibleReply(response.data.reply),
          taxRuleTimelines: Array.isArray(response.data?.taxRuleTimelines) ? response.data.taxRuleTimelines : [],
        },
      ]);
    } catch (error: any) {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
        return;
      }
      if (activeRequestIdRef.current !== requestId) return;
      if (error?.response?.status === 403 && error?.response?.data?.usage) {
        setSubscription(error.response.data.usage);
        setProviderWarning(error.response?.data?.error || "Free plan limit reached. Upgrade to Professional.");
        return;
      }
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
          taxRuleTimelines: [],
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
    setPopupBounds(isCompactViewport ? getViewportPopupBounds() : getDefaultPopupBounds());
    setIsPopupExpanded(false);
    setResizeDirection(null);
    setIsPopupOpen(true);
  };

  const handlePopupHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPopupExpanded || isCompactViewport || popupResizeRef.current) return;
    popupDragRef.current = {
      offsetX: event.clientX - popupBounds.x,
      offsetY: event.clientY - popupBounds.y,
    };
  };

  const handlePopupExpandToggle = () => {
    if (typeof window === "undefined" || isCompactViewport) return;

    if (isPopupExpanded) {
      setPopupBounds(getDefaultPopupBounds());
      setIsPopupExpanded(false);
      return;
    }

    setPopupBounds({
      width: Math.max(420, window.innerWidth - 24),
      height: Math.max(360, window.innerHeight - 24),
      x: 12,
      y: 12,
    });
    setIsPopupExpanded(true);
  };

  const handleResizePointerDown = (
    direction: Exclude<ResizeDirection, null>,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (isCompactViewport) return;
    event.preventDefault();
    event.stopPropagation();
    popupResizeRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startBounds: popupBounds,
    };
    setResizeDirection(direction);
    document.body.style.userSelect = "none";
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

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (popupResizeRef.current) {
        const { direction, startX, startY, startBounds } = popupResizeRef.current;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        let nextBounds = { ...startBounds };

        if (direction === "right" || direction === "bottom-right") {
          nextBounds.width = startBounds.width + deltaX;
        }

        if (direction === "left" || direction === "bottom-left") {
          nextBounds.width = startBounds.width - deltaX;
          nextBounds.x = startBounds.x + deltaX;
        }

        if (direction === "bottom" || direction === "bottom-left" || direction === "bottom-right") {
          nextBounds.height = startBounds.height + deltaY;
        }

        setPopupBounds(getClampedPopupBounds(nextBounds));
        return;
      }

      if (!popupDragRef.current || isPopupExpanded) return;

      setPopupBounds((current) => {
        const nextX = clamp(
          event.clientX - popupDragRef.current!.offsetX,
          8,
          Math.max(8, window.innerWidth - current.width - 8)
        );
        const nextY = clamp(
          event.clientY - popupDragRef.current!.offsetY,
          8,
          Math.max(8, window.innerHeight - current.height - 8)
        );
        return { ...current, x: nextX, y: nextY };
      });
    };

    const handlePointerUp = () => {
      popupDragRef.current = null;
      popupResizeRef.current = null;
      setResizeDirection(null);
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isPopupExpanded]);

  useEffect(() => {
    if (!isPopupOpen || !popupPanelRef.current || isPopupExpanded) return;

    const panel = popupPanelRef.current;
    const observer = new ResizeObserver(() => {
      const nextWidth = panel.offsetWidth;
      const nextHeight = panel.offsetHeight;
      setPopupBounds((current) => {
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return {
          ...current,
          width: nextWidth,
          height: nextHeight,
        };
      });
    });

    observer.observe(panel);
    return () => observer.disconnect();
  }, [isPopupOpen, isPopupExpanded]);

  useEffect(() => {
    if (!isPopupOpen) {
      popupResizeRef.current = null;
      popupDragRef.current = null;
      setResizeDirection(null);
      document.body.style.userSelect = "";
    }
  }, [isPopupOpen]);

  useEffect(() => {
    const handleWindowResize = () => {
      if (typeof window === "undefined") return;
      const compact = window.innerWidth < 1024;
      setIsCompactViewport(compact);

      setPopupBounds((current) => {
        if (compact) {
          return getViewportPopupBounds();
        }

        if (isPopupExpanded) {
          return getViewportPopupBounds();
        }

        return getClampedPopupBounds(current);
      });
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [isPopupExpanded]);

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
            <span className="text-sm">AI Chat Assistant</span>
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
              <CardHeader
                className="flex-shrink-0 cursor-pointer"
                onClick={handleOpenPopup}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenPopup();
                  }
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-[#CBD5E1] bg-[#E2E8F0] p-2">
                      <Bot className="size-6 text-[#0F172A]" />
                    </div>
                    <div>
                      <CardTitle className="text-[#0F172A]">AI Chat Assistant</CardTitle>
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
                {subscription ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-[#CBD5E1] bg-white text-[#0F172A]">
                      Current Plan: {subscription.currentPlan?.displayName || "Starter"}
                    </Badge>
                    <Badge className="border border-[#CBD5E1] bg-white text-[#0F172A]">
                      {getRemainingChatLabel(subscription)}
                    </Badge>
                  </div>
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
                              ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                            }}
                          >
                            {ensureVisibleReply(message.content)}
                          </ReactMarkdown>
                          <TaxRuleTimeline timelines={message.taxRuleTimelines} compact />
                        </div>
                      ) : message.content}
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
                    placeholder={starterLimitReached ? "Free plan limit reached. Upgrade to Professional." : "Ask me a question"}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    className="min-h-[44px] max-h-32 resize-none border-[#E2E8F0] bg-[#F7FAFC]/90"
                    rows={1}
                    disabled={starterLimitReached}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    className="h-10 w-10 flex-shrink-0 border-[#E2E8F0]"
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
                      disabled={starterLimitReached}
                    >
                      <Send className="size-5" />
                    </Button>
                  )}
                </form>
              </CardFooter>
              {starterLimitReached ? (
                <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
                  Free plan limit reached. Upgrade to Professional for unlimited AI chat.
                  <Button type="button" variant="link" className="ml-2 h-auto p-0 text-amber-900" onClick={() => navigate("/pricing")}>
                    Upgrade to Professional
                  </Button>
                </div>
              ) : null}
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
                <CardDescription>Click to ask the AI Chat Assistant</CardDescription>
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
          <DialogContent
            className="left-0 top-0 max-w-none translate-x-0 translate-y-0 border-0 bg-transparent p-0 shadow-none duration-0 [&>button]:hidden"
            style={{
              width: popupBounds.width,
              height: popupBounds.height,
              left: popupBounds.x,
              top: popupBounds.y,
            }}
          >
            <DialogTitle className="sr-only">AI Chat Popup</DialogTitle>
            <div
              ref={popupPanelRef}
              className={`flex h-full overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl ${
                resizeDirection ? "select-none" : ""
              } ${isCompactViewport ? "rounded-none" : ""}`}
            >
              <div className="flex h-full w-full flex-col overflow-hidden">
                <div
                  className="cursor-move border-b border-[#E2E8F0] bg-[#F7FAFC] px-4 py-3 select-none"
                  onPointerDown={handlePopupHeaderPointerDown}
                  onDoubleClick={isCompactViewport ? undefined : handlePopupExpandToggle}
                  title="Drag to move. Double-click to expand or restore."
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">AI Tax Chat</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPopupOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC]"
                      aria-label="Close AI chat popup"
                      title="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <AIChat onRequireLogin={onRequireLogin} minimal />
                </div>
              </div>
              {!isCompactViewport ? (
                <>
                  <div
                    className="absolute bottom-3 left-0 top-3 z-20 w-2 cursor-ew-resize"
                    onPointerDown={(event) => handleResizePointerDown("left", event)}
                  />
                  <div
                    className="absolute bottom-3 right-0 top-3 z-20 w-2 cursor-ew-resize"
                    onPointerDown={(event) => handleResizePointerDown("right", event)}
                  />
                  <div
                    className="absolute bottom-0 left-3 right-3 z-20 h-2 cursor-ns-resize"
                    onPointerDown={(event) => handleResizePointerDown("bottom", event)}
                  />
                  <div
                    className="absolute bottom-0 left-0 z-20 h-4 w-4 cursor-nesw-resize"
                    onPointerDown={(event) => handleResizePointerDown("bottom-left", event)}
                  />
                  <div
                    className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize"
                    onPointerDown={(event) => handleResizePointerDown("bottom-right", event)}
                  />
                </>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
