import { useEffect, useRef, useState } from "react";
import { Bot, Briefcase, Calculator, CreditCard, MessageSquareText, Send, ShieldCheck, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
      "Hi, I am Nexa. Ask me about this website, our services, pricing, calculators, compliance, or how to contact an expert.",
  },
];

const getWebsiteBotReply = (query: string) => {
  const text = query.trim().toLowerCase();

  if (!text) {
    return {
      message: "Please type your question. I can help with services, pricing, calculators, compliance, and booking a CPA.",
      actions: serviceOptions,
    };
  }

  if (/(price|pricing|plan|subscription|cost|fee)/.test(text)) {
    return {
      message: "You can check all subscription and pricing details on our Pricing page. If you want, I can open it for you now.",
      actions: serviceOptions.filter((item) => item.to === "/pricing"),
    };
  }

  if (/(login|log in|sign in|signup|sign up|register|account)/.test(text)) {
    return {
      message: "You can use Login / Sign Up from the top navigation to access your account and premium features.",
      actions: [],
    };
  }

  if (/(profile|my profile|account details|user profile)/.test(text)) {
    return {
      message: "Your profile page lets you view and manage your account details after signing in.",
      actions: [],
    };
  }

  if (/(calculator|calculate|tax calculator|residency|income tax|dtaa credit)/.test(text)) {
    return {
      message: "We provide Tax Calculators including residency status, income tax, and DTAA tax credit tools. I can take you to the calculator page.",
      actions: serviceOptions.filter((item) => item.to === "/calculators"),
    };
  }

  if (/(cpa|consult|expert|book|appointment|consultation)/.test(text)) {
    return {
      message: "You can book expert help through our Consult a CPA page for personalized assistance.",
      actions: serviceOptions.filter((item) => item.to === "/consult"),
    };
  }

  if (/(compliance|security|ssl|soc 2|dtaa compliant|encrypted)/.test(text)) {
    return {
      message: "Our website highlights compliance and trust information such as SSL encryption, ICAI-registered CPA support, DTAA compliance, and security standards.",
      actions: serviceOptions.filter((item) => item.to === "/compliance"),
    };
  }

  if (/(document|documents|trc|form 10f|checklist|upload|pdf)/.test(text)) {
    return {
      message: "For document-related tax guidance like TRC, Form 10F, and checklists, the AI Tax Chat can help. For broader website guidance, I can also direct you to calculators or consultation.",
      actions: serviceOptions.filter((item) => item.to === "/chat" || item.to === "/consult"),
    };
  }

  if (/(how to use|use calculator|calculator help|how does calculator work)/.test(text)) {
    return {
      message: "On the Tax Calculator page, you can choose a calculator type such as residency, income tax, or DTAA credit, then enter your details to view the result.",
      actions: serviceOptions.filter((item) => item.to === "/calculators"),
    };
  }

  if (/(chat|ai chat|assistant|nexa|bot)/.test(text)) {
    return {
      message: "For detailed tax questions, you can open the AI Tax Chat page and continue the conversation there.",
      actions: serviceOptions.filter((item) => item.to === "/chat"),
    };
  }

  if (/(feature|service|offer|provide|website|platform)/.test(text)) {
    return {
      message: "This platform provides AI tax chat, tax calculators, pricing plans, compliance information, and CPA consultation support for NRI users.",
      actions: serviceOptions,
    };
  }

  if (/(update|news|tax updates|latest)/.test(text)) {
    return {
      message: "The website also includes a Tax Updates section where users can review recent tax and compliance updates.",
      actions: [],
    };
  }

  return {
    message:
      "I can help with website-related questions like pricing, calculators, compliance, AI chat, and CPA consultation. For detailed tax advice, open AI Tax Chat.",
    actions: serviceOptions.filter((item) => item.to === "/chat"),
  };
};

export function TigerBotAvatar() {
  const navigate = useNavigate();
  const location = useLocation();
  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>(initialMessages);
  const [suggestedActions, setSuggestedActions] = useState<ServiceOption[]>(serviceOptions);

  const resetWidgetState = () => {
    setQuery("");
    setMessages(initialMessages);
    setSuggestedActions(serviceOptions);
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
    setIsOpen(false);
    if (location.pathname === to) return;
    navigate(to);
  };

  const handleQuerySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const reply = getWebsiteBotReply(trimmedQuery);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmedQuery },
      { role: "bot", content: reply.message },
    ]);
    setSuggestedActions(reply.actions);
    setQuery("");
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
                <p className="text-lg font-semibold leading-none">Nexa</p>
                <p className="mt-1 text-sm text-[#1F2937]/80">What services do you need?</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetWidgetState();
                setIsOpen(false);
              }}
              aria-label="Close Nexa widget"
              className="rounded-full p-1 text-[#0F172A]/75 transition hover:bg-white/30 hover:text-[#0F172A]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="max-h-[390px] overflow-y-auto p-3">
            <div ref={messagesRef} className="max-h-[180px] space-y-3 overflow-y-auto pr-1">
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
            </div>

            <div className="mt-3 max-h-[132px] space-y-2 overflow-y-auto pr-1">
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
                placeholder="Ask about this website..."
                rows={2}
                className="w-full resize-none rounded-2xl border border-[#D1FAE5] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#86D39B] focus:ring-2 focus:ring-[#DCFCE7]"
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#86D39B] px-4 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#72C68A]"
              >
                <Send className="size-4" />
                Ask Nexa
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleToggleWidget}
        aria-label="Open Nexa widget"
        className="group flex items-center gap-2 rounded-full border border-[#1E40AF] bg-[#2563EB]/95 p-2 pr-3 text-white shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1E3A8A] shadow-md">
          <Bot className="size-6" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
        </span>
        <span className="text-sm font-semibold text-white">Nexa</span>
      </button>
    </div>
  );
}
