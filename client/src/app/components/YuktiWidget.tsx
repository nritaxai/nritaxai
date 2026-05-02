import { Bot, Briefcase, Calculator, CreditCard, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getStoredAuthToken, submitYuktiGrievance } from "../../utils/api";

type ServiceOption = {
  label: string;
  action: "route" | "email";
  value: string;
  icon: typeof Calculator;
};

type WidgetMessage = {
  role: "bot" | "user";
  content: string;
};

type YuktiMode = "default" | "awaiting_grievance_details";

type YuktiWidgetProps = {
  fullScreen?: boolean;
  androidMode?: boolean;
  onRouteChange?: () => void;
};

const serviceOptions: ServiceOption[] = [
  { label: "Tax Calculator", action: "route", value: "/calculators", icon: Calculator },
  { label: "AI Tax Chat", action: "route", value: "/chat", icon: MessageSquareText },
  { label: "Consult a CPA", action: "route", value: "/consult", icon: Briefcase },
  { label: "Pricing Plans", action: "route", value: "/pricing", icon: CreditCard },
  { label: "Compliance", action: "route", value: "/compliance", icon: ShieldCheck },
];

const supportOptions: ServiceOption[] = [
  {
    label: "Email Support",
    action: "email",
    value: "mailto:ask@nritax.ai?subject=Support%20Request%20-%20NRITAX.AI",
    icon: MessageSquareText,
  },
  { label: "Send Support Message", action: "route", value: "/consult", icon: Briefcase },
];

const initialMessages: WidgetMessage[] = [
  {
    role: "bot",
    content:
      "Hi, I am YUKTI. Ask me about this website, our services, pricing, calculators, compliance, or contact support by email or message.",
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

  if (/(can't log in|cant log in|cannot log in|unable to log in|login issue|login problem|trouble logging in|forgot password|reset password|password reset|sign in issue)/.test(text)) {
    return {
      message:
        "If you cannot log in, please open the Login page and use 'Forgot password?' to reset your password. If it still does not work, use Email Support or Send Support Message here and we will help you recover access.",
      actions: supportOptions,
    };
  }

  if (/(cancel my plan|cancel plan|cancel subscription|stop subscription|unsubscribe|end my plan|close subscription|stop my plan)/.test(text)) {
    return {
      message:
        "If you want to cancel your plan, please open Pricing or contact support from this chat and we will help you with cancellation or billing questions.",
      actions: [...serviceOptions.filter((item) => item.value === "/pricing"), ...supportOptions],
    };
  }

  if (/(billing issue|payment issue|charged|charge|refund|invoice|payment failed|transaction|renewal)/.test(text)) {
    return {
      message:
        "For billing, refund, payment, or renewal issues, please contact support directly from this chat. Include the payment details in your message so we can investigate quickly.",
      actions: supportOptions,
    };
  }

  if (/(price|pricing|cost|fee|plans|compare plans)/.test(text)) {
    return {
      message: "You can check all subscription and pricing details on our Pricing page. If you want, I can open it for you now.",
      actions: serviceOptions.filter((item) => item.value === "/pricing"),
    };
  }

  if (/(login|log in|sign in|signup|sign up|register)/.test(text)) {
    return {
      message: "You can use Login / Sign Up from the top navigation to access your account and premium features.",
      actions: [],
    };
  }

  if (/(account|profile|my profile|account details|user profile)/.test(text)) {
    return {
      message: "Your profile page lets you view and manage your account details after signing in.",
      actions: [],
    };
  }

  if (/(calculator|calculate|tax calculator|residency|income tax|dtaa credit)/.test(text)) {
    return {
      message: "We provide Tax Calculators including residency status, income tax, and DTAA tax credit tools. I can take you to the calculator page.",
      actions: serviceOptions.filter((item) => item.value === "/calculators"),
    };
  }

  if (/(cpa|consult|expert|book|appointment|consultation)/.test(text)) {
    return {
      message: "You can book expert help through our Consult a CPA page for personalized assistance.",
      actions: serviceOptions.filter((item) => item.value === "/consult"),
    };
  }

  if (/(compliance|security|ssl|soc 2|dtaa compliant|encrypted)/.test(text)) {
    return {
      message: "Our website highlights compliance and trust information such as SSL encryption, ICAI-registered CPA support, DTAA compliance, and security standards.",
      actions: serviceOptions.filter((item) => item.value === "/compliance"),
    };
  }

  if (/(document|documents|trc|form 10f|checklist|upload|pdf)/.test(text)) {
    return {
      message: "For document-related tax guidance like TRC, Form 10F, and checklists, the AI Tax Chat can help. For broader website guidance, I can also direct you to calculators or consultation.",
      actions: serviceOptions.filter((item) => item.value === "/chat" || item.value === "/consult"),
    };
  }

  if (/(how to use|use calculator|calculator help|how does calculator work)/.test(text)) {
    return {
      message: "On the Tax Calculator page, you can choose a calculator type such as residency, income tax, or DTAA credit, then enter your details to view the result.",
      actions: serviceOptions.filter((item) => item.value === "/calculators"),
    };
  }

  if (/(chat|ai chat|assistant|nexa|bot)/.test(text)) {
    return {
      message: "For detailed tax questions, you can open the AI Tax Chat page and continue the conversation there.",
      actions: serviceOptions.filter((item) => item.value === "/chat"),
    };
  }

  if (/(support|contact|email|mail|message|help|customer care|customer support)/.test(text)) {
    return {
      message:
        "You can connect with support directly from here. Choose Email Support to write to ask@nritax.ai, or choose Send Support Message to share your issue through our contact form. If you tell me your problem in this chat, I can also guide you to the right page.",
      actions: supportOptions,
    };
  }

  if (/(feature|service|offer|provide|website|platform)/.test(text)) {
    return {
      message: "This platform provides AI tax chat, tax calculators, pricing plans, compliance information, and CPA consultation support for NRI users.",
      actions: [...serviceOptions, ...supportOptions],
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
    actions: [...serviceOptions.filter((item) => item.value === "/chat"), ...supportOptions],
  };
};

export function YuktiWidget({ fullScreen = false, androidMode = false, onRouteChange }: YuktiWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const messagesRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>(initialMessages);
  const [suggestedActions, setSuggestedActions] = useState<ServiceOption[]>([
    ...serviceOptions,
    ...supportOptions,
  ]);
  const [mode, setMode] = useState<YuktiMode>("default");
  const [isSubmittingGrievance, setIsSubmittingGrievance] = useState(false);

  const resetWidgetState = () => {
    setQuery("");
    setMessages(initialMessages);
    setSuggestedActions([...serviceOptions, ...supportOptions]);
    setMode("default");
    setIsSubmittingGrievance(false);
  };

  useEffect(() => {
    resetWidgetState();
  }, [location.pathname]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, suggestedActions]);

  const handleServiceSelect = (service: ServiceOption) => {
    if (service.action === "email") {
      window.location.href = service.value;
      return;
    }

    const to = service.value;
    const requiresAuth = to === "/calculators" || to === "/chat" || to === "/consult";
    if (requiresAuth && !getStoredAuthToken()) {
      navigate(location.pathname, { replace: true });
      window.dispatchEvent(new CustomEvent("nritax:require-login"));
      return;
    }
    if (location.pathname === to) return;
    onRouteChange?.();
    navigate(to);
  };

  const handleQuerySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmittingGrievance) return;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    if (mode === "awaiting_grievance_details") {
      setMessages((prev) => [...prev, { role: "user", content: trimmedQuery }]);
      setQuery("");
      setIsSubmittingGrievance(true);

      // Android only
      void submitYuktiGrievance({
        message: trimmedQuery,
        source: androidMode ? "Yukti Android Page" : "Yukti Chat Widget",
        page: location.pathname,
      })
        .then((response: any) => {
          const ticketNumber = response?.ticketNumber || "Pending";
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: `I've submitted your grievance. Your ticket ID is ${ticketNumber}. Our support team will review it and follow up on your registered email if needed. You can also use Email Support here for urgent follow-up.`,
            },
          ]);
          setSuggestedActions(supportOptions);
          setMode("default");
        })
        .catch((error: any) => {
          const message =
            error?.response?.data?.message ||
            error?.message ||
            "I could not submit your grievance right now. Please try again or use Email Support.";
          setMessages((prev) => [...prev, { role: "bot", content: message }]);
          setSuggestedActions(supportOptions);
          setMode("default");
        })
        .finally(() => {
          setIsSubmittingGrievance(false);
        });

      return;
    }

    const reply = getWebsiteBotReply(trimmedQuery);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmedQuery },
      { role: "bot", content: reply.message },
    ]);
    setSuggestedActions(reply.actions);
    if (/(support|contact|email|mail|message|help|customer care|customer support|grievance|complaint|issue|problem)/.test(trimmedQuery.toLowerCase())) {
      setMode("awaiting_grievance_details");
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "Please describe your grievance in one message, and I'll submit it for you directly from this chat." },
      ]);
    } else {
      setMode("default");
    }
    setQuery("");
  };

  return (
    <div className={`flex h-full flex-col ${fullScreen ? "bg-[#f8f9fa]" : ""}`}>
      <div className={`flex-1 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${fullScreen ? "pb-4" : ""}`}>
        <div
          ref={messagesRef}
          className={`${fullScreen ? "max-h-none min-h-[220px]" : "max-h-[180px]"} space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
        >
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? `max-w-[85%] rounded-2xl px-3 py-2 text-sm ${fullScreen ? "bg-[#1a3cff] text-white" : "bg-[#86D39B] text-[#0F172A]"}`
                    : `max-w-[88%] rounded-2xl px-3 py-2 text-sm text-[#0F172A] ${fullScreen ? "border border-[#E2E8F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]" : "border border-[#D1FAE5] bg-[#F8FAFC]"}`
                }
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <div className={`${fullScreen ? "mt-4 max-h-[220px]" : "mt-3 max-h-[132px]"} space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}>
          {suggestedActions.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.label}
                type="button"
                onClick={() => handleServiceSelect(service)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#0F172A] transition ${fullScreen ? "border border-[#E2E8F0] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:border-[#1a3cff]/20" : "border border-[#D1FAE5] bg-[#F8FAFC] hover:border-[#86D39B] hover:bg-[#F0FDF4]"}`}
              >
                <span className={`rounded-xl p-2 shadow-sm ${fullScreen ? "bg-[#EEF2FF] text-[#1a3cff]" : "bg-white text-[#4C9A63]"}`}>
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium leading-tight">{service.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleQuerySubmit} className={`space-y-2 border-t ${fullScreen ? "border-[#E2E8F0] bg-white p-4" : "border-transparent px-3 pb-3"}`}>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask about this website..."
          rows={fullScreen ? 3 : 2}
          disabled={isSubmittingGrievance}
          className={`w-full resize-none rounded-2xl px-3 py-2.5 text-sm text-[#0F172A] outline-none transition ${fullScreen ? "border border-[#E2E8F0] bg-white focus:border-[#1a3cff] focus:ring-2 focus:ring-[#DBEAFE]" : "border border-[#D1FAE5] bg-white focus:border-[#86D39B] focus:ring-2 focus:ring-[#DCFCE7]"}`}
        />
        <button
          type="submit"
          disabled={isSubmittingGrievance}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${fullScreen ? "bg-[#1a3cff] text-white hover:bg-[#1635db]" : "bg-[#86D39B] text-[#0F172A] hover:bg-[#72C68A]"}`}
        >
          <Send className="size-4" />
          {isSubmittingGrievance ? "Submitting..." : "Ask YUKTI"}
        </button>
      </form>
    </div>
  );
}
