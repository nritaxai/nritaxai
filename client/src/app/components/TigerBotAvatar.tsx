import { useEffect, useRef, useState } from "react";
import { Bot, Briefcase, Calculator, CreditCard, MessageSquareText, Send, ShieldCheck, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildApiUrl, getStoredAuthToken } from "../../utils/api";

type ServiceOption = {
  label: string;
  to: string;
  icon: typeof Calculator;
};

type WidgetMessage = {
  role: "bot" | "user";
  content: string;
};

const serviceOptions: ServiceOption[] = [
  { label: "Tax Calculator", to: "/calculators", icon: Calculator },
  { label: "AI Tax Chat", to: "/chat", icon: MessageSquareText },
  { label: "Consult a CPA", to: "/consult", icon: Briefcase },
  { label: "Pricing Plans", to: "/pricing", icon: CreditCard },
  { label: "Compliance", to: "/compliance", icon: ShieldCheck },
];

const initialMessages: WidgetMessage[] = [
  {
    role: "bot",
    content:
      "Hi, I am YUKTI. Ask me tax-related questions, especially about Indian tax, NRI tax, DTAA, ITR, TDS, and residential status.",
  },
];

export function TigerBotAvatar() {
  const navigate = useNavigate();
  const location = useLocation();
  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>(initialMessages);
  const [suggestedActions, setSuggestedActions] = useState<ServiceOption[]>(serviceOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resetWidgetState = () => {
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = null;
    setQuery("");
    setMessages(initialMessages);
    setSuggestedActions(serviceOptions);
    setIsLoading(false);
    setErrorMessage("");
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!widgetRef.current?.contains(event.target as Node)) {
        resetWidgetState();
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    resetWidgetState();
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, suggestedActions, isOpen]);

  const handleToggleWidget = () => {
    setIsOpen((prev) => !prev);
  };

  const handleServiceSelect = (to: string) => {
    const requiresAuth = to === "/calculators" || to === "/chat" || to === "/consult";
    setIsOpen(false);
    if (requiresAuth && !getStoredAuthToken()) {
      navigate(location.pathname, { replace: true });
      window.dispatchEvent(new CustomEvent("nritax:require-login"));
      return;
    }
    if (location.pathname === to) return;
    navigate(to);
  };

  const handleQuerySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isLoading) return;

    const controller = new AbortController();
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = controller;
    setMessages((prev) => [...prev, { role: "user", content: trimmedQuery }]);
    setQuery("");
    setErrorMessage("");
    setIsLoading(true);

    try {
      const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      const userId =
        typeof storedUser?._id === "string" && storedUser._id.trim()
          ? storedUser._id.trim()
          : undefined;

      const response = await fetch(buildApiUrl("/api/yukti/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {}),
        },
        body: JSON.stringify({
          question: trimmedQuery,
          ...(userId ? { userId } : {}),
        }),
        signal: controller.signal,
      });

      const result = (await response.json().catch(() => null)) as
        | { answer?: string; ok?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(result?.answer || "Unable to reach Yukti right now. Please try again.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            typeof result?.answer === "string" && result.answer.trim()
              ? result.answer.trim()
              : "Yukti did not return a usable answer.",
        },
      ]);
      setSuggestedActions(serviceOptions);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return;
      }
      const message = error?.message || "Unable to reach Yukti right now. Please try again.";
      setErrorMessage(message);
      setMessages((prev) => [...prev, { role: "bot", content: message }]);
    } finally {
      activeRequestControllerRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div ref={widgetRef} className="fixed bottom-20 right-4 z-[80] sm:bottom-6 sm:right-6">
      {isOpen ? (
        <div className="mb-3 w-[min(84vw,290px)] overflow-hidden rounded-[22px] border border-[#BBF7D0] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <div className="flex items-start justify-between bg-[#86D39B] px-4 py-4 text-[#0F172A]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/70 bg-white text-[#4C9A63]">
                <Bot className="size-5" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
              </span>
              <div>
                <p className="text-lg font-semibold leading-none">YUKTI</p>
                <p className="mt-1 text-sm text-[#1F2937]/80">Tax-only help for Indian tax and NRI tax</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetWidgetState();
                setIsOpen(false);
              }}
              aria-label="Close YUKTI widget"
              className="rounded-full p-1 text-[#0F172A]/75 transition hover:bg-white/30 hover:text-[#0F172A]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="max-h-[390px] overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Yukti answers only tax-related questions.
            </p>
            <div
              ref={messagesRef}
              className="max-h-[180px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl bg-[#86D39B] px-3 py-2 text-sm text-[#0F172A]"
                        : "max-w-[88%] rounded-2xl border border-[#D1FAE5] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]"
                    }
                  >
                    {message.content}
                  </div>
                </div>
                ))}
              {isLoading ? (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl border border-[#D1FAE5] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#0F172A]">
                    Thinking.....
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3 max-h-[132px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {suggestedActions.map((service) => {
                const Icon = service.icon;
                return (
                  <button
                    key={service.label}
                    type="button"
                    onClick={() => handleServiceSelect(service.to)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#D1FAE5] bg-[#F8FAFC] px-3 py-3 text-left text-[#0F172A] transition hover:border-[#86D39B] hover:bg-[#F0FDF4]"
                  >
                    <span className="rounded-xl bg-white p-2 text-[#4C9A63] shadow-sm">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium leading-tight">{service.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleQuerySubmit} className="mt-3 space-y-2">
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask a tax question..."
                rows={2}
                className="w-full resize-none rounded-2xl border border-[#D1FAE5] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#86D39B] focus:ring-2 focus:ring-[#DCFCE7]"
              />
              {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#86D39B] px-4 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#72C68A] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="size-4" />
                {isLoading ? "Thinking....." : "Ask YUKTI"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleToggleWidget}
        aria-label="Open YUKTI widget"
        className="group flex items-center gap-2 rounded-full border border-[#1E40AF] bg-[#2563EB]/95 p-2 pr-3 text-white shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1E3A8A] shadow-md">
          <Bot className="size-6" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
        </span>
        <span className="text-sm font-semibold text-white">YUKTI</span>
      </button>
    </div>
  );
}
