import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Briefcase,
  Calculator,
  CreditCard,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";
import { getStoredAuthToken, submitYuktiGrievance } from "../utils/api";

type ServiceOption = {
  label: string;
  value: string;
  icon: typeof Calculator;
  requiresAuth?: boolean;
};

type YuktiMessage = {
  role: "bot" | "user";
  content: string;
};

const serviceOptions: ServiceOption[] = [
  { label: "Tax Calculator", value: "/calculators", icon: Calculator, requiresAuth: true },
  { label: "AI Tax Chat", value: "/chat", icon: MessageSquareText, requiresAuth: true },
  { label: "Consult a CPA", value: "/consult", icon: Briefcase, requiresAuth: true },
  { label: "Pricing Plans", value: "/pricing", icon: CreditCard },
  { label: "Compliance", value: "/compliance", icon: ShieldCheck },
];

const initialMessages: YuktiMessage[] = [
  {
    role: "bot",
    content:
      "Hi, I am YUKTI. Ask me about this website, our services, pricing, calculators, compliance, or contact support by email or message.",
  },
];

const getReply = (query: string) => {
  const text = query.trim().toLowerCase();
  if (/(price|pricing|cost|fee|plans|upgrade)/.test(text)) {
    return "You can review subscription options on Pricing Plans. I can open it for you from the list above.";
  }
  if (/(calculator|calculate|tax calculator|residency|dtaa)/.test(text)) {
    return "Use Tax Calculator for residency, income tax, and DTAA credit estimates.";
  }
  if (/(chat|ai|question|tax help|advice)/.test(text)) {
    return "AI Tax Chat is best for detailed NRI tax questions and follow-up conversations.";
  }
  if (/(cpa|consult|expert|appointment|book)/.test(text)) {
    return "Consult a CPA lets you book expert help for personalized tax guidance.";
  }
  if (/(support|contact|email|message|help|complaint|grievance|issue|problem)/.test(text)) {
    return "Please describe the issue clearly. I will submit it as a support grievance for review.";
  }
  return "I can help with NRITAX services, pricing, calculators, compliance, AI chat, and CPA consultation.";
};

export function iOSYuktiPage() {
  const navigate = useNavigate();
  const messagesRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<YuktiMessage[]>(initialMessages);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAskedForSupport = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "user" &&
          /(support|contact|email|message|help|complaint|grievance|issue|problem)/i.test(message.content)
      ),
    [messages]
  );

  const handleServiceSelect = (service: ServiceOption) => {
    if (service.requiresAuth && !getStoredAuthToken()) {
      window.dispatchEvent(new CustomEvent("nritax:require-login"));
      return;
    }
    navigate(service.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSubmitting) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuery("");

    if (hasAskedForSupport) {
      setIsSubmitting(true);
      void submitYuktiGrievance({
        message: trimmed,
        source: "Yukti iOS Page",
        page: "/yukti",
      })
        .then((response: any) => {
          const ticketNumber = response?.ticketNumber || "Pending";
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: `I've submitted your grievance. Your ticket ID is ${ticketNumber}.`,
            },
          ]);
        })
        .catch((error: any) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content:
                error?.response?.data?.message ||
                error?.message ||
                "I could not submit that right now. Please try again.",
            },
          ]);
        })
        .finally(() => setIsSubmitting(false));
      return;
    }

    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: "bot", content: getReply(trimmed) }]);
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        backgroundColor: "#f5f6fa",
        padding: "calc(64px + env(safe-area-inset-top)) 22px calc(168px + env(safe-area-inset-bottom))",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
      }}
    >
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          minHeight: "calc(58px + env(safe-area-inset-top))",
          padding: "env(safe-area-inset-top) 28px 10px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 14,
          backgroundColor: "#1648ff",
          color: "#ffffff",
          boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "999px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            color: "#1648ff",
            flex: "0 0 auto",
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          }}
        >
          <Bot style={{ width: 28, height: 28 }} />
        </span>
        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 23, lineHeight: 1, letterSpacing: 0 }}>YUKTI</strong>
          <span style={{ fontSize: 16, lineHeight: 1.2, color: "rgba(255,255,255,0.82)" }}>
            Your NRI Tax Assistant
          </span>
        </span>
      </header>

      <section
        ref={messagesRef}
        style={{
          display: "grid",
          gap: 18,
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            style={{
              display: "flex",
              justifyContent: message.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: message.role === "user" ? "82%" : "88%",
                borderRadius: 22,
                backgroundColor: message.role === "user" ? "#1648ff" : "#ffffff",
                color: message.role === "user" ? "#ffffff" : "#111827",
                padding: "16px 20px",
                fontSize: 18,
                lineHeight: 1.45,
                boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
                border: message.role === "user" ? "none" : "1px solid #e5e7eb",
              }}
            >
              {message.content}
            </div>
          </div>
        ))}

        <div style={{ minHeight: 220 }} />

        <div style={{ display: "grid", gap: 14 }}>
          {serviceOptions.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.label}
                type="button"
                onClick={() => handleServiceSelect(service)}
                style={{
                  minHeight: 82,
                  border: "1px solid #e5e7eb",
                  borderRadius: 24,
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "0 24px",
                  fontSize: 20,
                  fontWeight: 650,
                  textAlign: "left",
                  boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#eef3ff",
                    color: "#1648ff",
                    boxShadow: "0 6px 14px rgba(22,72,255,0.10)",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon style={{ width: 24, height: 24 }} />
                </span>
                <span>{service.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(49px + env(safe-area-inset-bottom))",
          zIndex: 9998,
          backgroundColor: "#ffffff",
          borderTop: "1px solid #e5e7eb",
          padding: "24px 28px 28px",
          display: "grid",
          gap: 18,
          fontFamily: "inherit",
        }}
      >
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask about this website..."
          disabled={isSubmitting}
          rows={3}
          style={{
            width: "100%",
            minHeight: 112,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            padding: "20px 22px",
            color: "#111827",
            fontSize: 18,
            lineHeight: 1.4,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            minHeight: 64,
            border: "none",
            borderRadius: 24,
            backgroundColor: "#1648ff",
            color: "#ffffff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 20,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <Send style={{ width: 24, height: 24 }} />
          {isSubmitting ? "Submitting..." : "Ask YUKTI"}
        </button>
      </form>
    </main>
  );
}

export default iOSYuktiPage;
