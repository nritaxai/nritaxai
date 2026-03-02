import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Bot, Send, Languages, Sparkles, Mic, MicOff, Download, Trash2 } from "lucide-react";
import { buildApiUrl, getSubscriptionStatus } from "../../utils/api";

interface ChatProps {
  onRequireLogin: () => void;
}

export function Chat({ onRequireLogin }: ChatProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("english");
  const knowledgeSource = "dtaa";
  const [subscription, setSubscription] = useState<{ plan?: string; status?: string } | null>(null);
  const welcomeByLanguage: Record<string, string> = {
    english:
      "Hello! I'm AI Assistant and ready to help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?",
    tamil:
      "வணக்கம்! நான் AI assistant மூலம் செயல்படுகிறேன். DTAA விதிகள், NRI வரி கேள்விகள் மற்றும் வரி திட்டமிடலில் உதவ தயாராக இருக்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?",
    hindi:
      "नमस्ते! मैं AI assistant द्वारा संचालित हूं और DTAA नियमों, NRI टैक्स प्रश्नों और टैक्स योजना में आपकी मदद के लिए तैयार हूं। मैं आज आपकी कैसे सहायता कर सकता हूं?",
    indonesian:
      "Halo! Saya didukung oleh AI assistant dan siap membantu Anda terkait regulasi DTAA, pertanyaan pajak NRI, dan perencanaan pajak. Bagaimana saya bisa membantu Anda hari ini?",
  };
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([
    {
      role: "ai",
      content: welcomeByLanguage.english
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef("");

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
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const welcomeMessage = getWelcomeMessage();
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
  const renderAiMessage = (content: string) => {
    const lines = content.split("\n");
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

  const isAuthenticated = Boolean(typeof window !== "undefined" && localStorage.getItem("token"));
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
    if (!isAuthenticated || !localStorage.getItem("token")) {
      setSubscription(null);
      return;
    }
    getSubscriptionStatus()
      .then((data: any) => setSubscription(data?.subscription ?? null))
      .catch(() => setSubscription(null));
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
    const welcomeMessage = getWelcomeMessage();
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
  }, [language, isAuthenticated, knowledgeSource]);

  const submitQuestion = async (forcedQuestion?: string) => {
    const effectiveQuestion = typeof forcedQuestion === "string" ? forcedQuestion.trim() : question.trim();
    if (!effectiveQuestion) return;

    if (!isAuthenticated) {
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
        { message: userMessage, language, knowledgeSource },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages((prev) => [
        ...prev,
        { role: "ai", content: response.data.reply },
      ]);
    } catch (error: any) {
      if (error.response?.status === 401) {
        onRequireLogin();
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: error.response?.data?.error || "AI service unavailable. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
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

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!question.trim()) return;

  //   setMessages(prev => [...prev, { role: "user", content: question }]);
  //   setQuestion("");
  //   setIsTyping(true);

  //   setTimeout(() => {
  //     const aiResponses = [
  //       "Based on current DTAA regulations between India and your country of residence, you may be eligible for tax relief. To provide specific guidance, I'll need to know: 1) Your country of residence, 2) Type of income (salary/capital gains/rental), and 3) Whether you have a Tax Residency Certificate.",
  //       "For the India-Singapore DTAA, the recent amendment effective April 1, 2025, reduces royalty withholding tax from 15% to 10%. This applies to payments made from April 1, 2025 onwards. You'll need to submit Form 10F along with your Tax Residency Certificate to claim treaty benefits.",
  //       "NRIs must file ITR if their total income in India exceeds ₹2.5 lakh (basic exemption limit). Common scenarios include: rental income, capital gains from property/shares sold in India, interest on NRO accounts, or business income. DTAA provisions can help reduce your tax liability.",
  //       "To claim DTAA benefits, you need: 1) Valid Tax Residency Certificate (TRC) from your country, 2) Form 10F submission, 3) PAN card, and 4) Documentation of income source. The TRC must be from the financial year for which you're claiming benefits.",
  //       "For NRO (Non-Resident Ordinary) accounts, interest earned is taxable at 30% (plus applicable surcharge and cess). However, you can claim DTAA benefits to reduce this rate. NRE (Non-Resident External) account interest is tax-free in India.",
  //       "Long-term capital gains (LTCG) on equity shares and equity mutual funds exceeding ₹1.25 lakh are taxed at 12.5%. Short-term capital gains (STCG) are taxed at 20%. Remember to check DTAA provisions for your country of residence."
  //     ];
      
  //     const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
  //     setMessages(prev => [...prev, { role: "ai", content: randomResponse }]);
  //     setIsTyping(false);
  //   }, 1500);
  // };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full mb-4">
            <Sparkles className="size-4" />
            <span className="text-sm">AI Assistant</span>
          </div>
          <h1 className="text-3xl sm:text-4xl mb-4">AI Tax Chat</h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Get instant, intelligent answers to all your NRI tax questions
          </p>
        </div>

        <div className="grid xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Chat */}
          <div className="xl:col-span-2">
            <Card className="flex h-[72dvh] min-h-[420px] max-h-[760px] flex-col sm:h-[68vh] xl:h-[700px]">
              <CardHeader className="flex-shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Bot className="size-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>AI Tax Assistant</CardTitle>
                      <CardDescription>Ask anything about NRI taxes and DTAA</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <span className="size-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    Online
                  </Badge>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4">
                  <Languages className="size-4 text-gray-500" />
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full sm:w-40">
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
                    className="w-full sm:w-auto sm:ml-auto"
                    onClick={downloadChatTranscript}
                  >
                    <Download className="size-4 mr-2" />
                    Download Chat
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={clearChat}>
                    <Trash2 className="size-4 mr-2" />
                    Clear Chat
                  </Button>
                </div>
              </CardHeader>

              <CardContent ref={chatContentRef} className="flex-1 overflow-y-auto space-y-4 px-3 sm:px-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] break-words rounded-lg px-4 py-3 sm:max-w-[80%] ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white border text-gray-900"
                      }`}
                    >
                      {message.role === "ai" ? renderAiMessage(message.content) : message.content}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border rounded-lg px-4 py-3">
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
                {!isAuthenticated ? (
                  <div className="w-full py-3 text-center">
                    <p className="text-gray-600 mb-2">Please log in to use AI Chat.</p>
                    <Button type="button" onClick={onRequireLogin}>
                      Login / Sign Up
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="w-full flex items-end gap-2">
                    <Textarea
                      ref={questionInputRef}
                      placeholder="Ask about DTAA, NRI taxes, tax planning, ITR filing..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleQuestionKeyDown}
                      className="resize-none min-h-[44px] max-h-32"
                      rows={1}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant={isListening ? "destructive" : "outline"}
                      className="h-10 w-10 flex-shrink-0"
                      onClick={toggleVoiceInput}
                      disabled={!speechSupported}
                      title={speechSupported ? "Voice input" : "Voice input not supported in this browser"}
                    >
                      {isListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    </Button>
                    <Button type="submit" size="icon" className="h-10 w-10 flex-shrink-0">
                      <Send className="size-5" />
                    </Button>
                  </form>
                )}
              </CardFooter>
              {isListening && (
                <p className="px-6 pb-4 text-xs text-red-600">Listening... tap mic again to stop.</p>
              )}
            </Card>
          </div>

          {/* Sidebar with starter questions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Starter Questions</CardTitle>
                <CardDescription>Click to ask</CardDescription>
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
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-900">Need expert-level support?</CardTitle>
                  <CardDescription className="text-blue-800">
                    Upgrade for deeper guidance and uninterrupted chat access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type="button" className="w-full" onClick={() => navigate("/pricing")}>
                    View Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




