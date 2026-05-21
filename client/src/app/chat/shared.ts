import type { TaxRuleTimelineItem } from "../components/TaxRuleTimeline";

export type ChatLanguage = "english" | "hindi" | "tamil" | "indonesian";

export type ChatMessage = {
  role: "user" | "ai";
  content: string;
  taxRuleTimelines?: TaxRuleTimelineItem[];
};

export const CHAT_LANGUAGE_OPTIONS: Array<{ value: ChatLanguage; label: string }> = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "tamil", label: "Tamil" },
  { value: "indonesian", label: "Bahasa Indonesia" },
];

export const CHAT_GUEST_HEADER = "x-guest-session-id";
const GUEST_SESSION_STORAGE_KEY = "nritax_guest_chat_session";

export const widgetWelcomeByLanguage: Record<ChatLanguage, string> = {
  english: "Welcome User!\n\nHow can I assist you today?",
  tamil: "Vanakkam User!\n\nIndru naan ungalukku eppadi uthavalam?",
  hindi: "Namaste User!\n\nMain aaj aapki kaise sahayata kar sakta hoon?",
  indonesian: "Selamat datang User!\n\nBagaimana saya bisa membantu Anda hari ini?",
};

export const pageWelcomeByLanguage: Record<ChatLanguage, string> = {
  english: "Hi! I am your AI chat assistant. I can help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?",
  tamil: "Vanakkam! Naan ungal AI chat assistant. DTAA vidhigal, NRI vari kelvigal, matrum vari thittamidhalil naan uthava tayaaraga irukkiren. Indru naan ungalukku eppadi uthavalam?",
  hindi: "Namaste! Main aapka AI chat assistant hoon. DTAA niyamon, NRI tax prashnon, aur tax planning mein main aapki madad kar sakta hoon. Main aaj aapki kaise sahayata kar sakta hoon?",
  indonesian:
    "Halo! Saya asisten chat AI Anda. Saya siap membantu Anda terkait regulasi DTAA, pertanyaan pajak NRI, dan perencanaan pajak. Bagaimana saya bisa membantu Anda hari ini?",
};

export const widgetStarterQuestionsByLanguage: Record<ChatLanguage, string[]> = {
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

export const pageStarterQuestionsByLanguage: Record<ChatLanguage, string[]> = {
  english: [
    "What is DTAA and how does it help NRIs?",
    "Do I need to file ITR as an NRI?",
    "How to claim India-USA DTAA benefits?",
    "What's the difference between NRO and NRE accounts?",
    "How is rental income taxed for NRIs?",
    "What documents do I need for Tax Residency Certificate?",
  ],
  hindi: [
    "DTAA NRIs ko kaise help karta hai?",
    "Kya mujhe NRI ke roop mein ITR file karna hai?",
    "India-USA DTAA benefits kaise claim karun?",
    "NRO aur NRE account mein kya fark hai?",
    "NRI rental income par tax kaise lagta hai?",
    "Tax Residency Certificate ke liye kaunse documents chahiye?",
  ],
  tamil: [
    "DTAA NRI-kalukku eppadi help pannum?",
    "NRI-a irundhaal ITR file seyyanuma?",
    "India-USA DTAA benefits eppadi claim pannalaam?",
    "NRO matrum NRE account-kku enna vithiyasam?",
    "NRI rental income-kku tax eppadi varum?",
    "Tax Residency Certificate-kku enna documents venum?",
  ],
  indonesian: [
    "Apa itu DTAA dan bagaimana membantu NRI?",
    "Apakah saya perlu lapor ITR sebagai NRI?",
    "Bagaimana cara klaim manfaat DTAA India-AS?",
    "Apa perbedaan akun NRO dan NRE?",
    "Bagaimana pajak penghasilan sewa untuk NRI?",
    "Dokumen apa yang dibutuhkan untuk Tax Residency Certificate?",
  ],
};

export const fallbackReplyByLanguage: Record<ChatLanguage, string> = {
  english:
    "### Answer\nI am temporarily unable to access live AI services.\n\n### Key Tax Points\n- Your chat request was received.\n- You can still proceed with general NRI tax planning steps.\n- For urgent cases, consult a CPA.\n\n### Next Steps\n- Re-try your question in 1-2 minutes.\n- If it persists, use CPA Consultation.\n\n### Follow-up Questions\n- Which NRI tax topic should we prioritize?\n- Do you want a checklist for DTAA documents?",
  hindi:
    "### Answer\nMain filhaal live AI services access nahi kar paa raha hoon.\n\n### Key Tax Points\n- Aapka chat request receive ho gaya hai.\n- Aap general NRI tax planning steps continue kar sakte hain.\n- Urgent case mein CPA se consult karein.\n\n### Next Steps\n- 1-2 minute baad apna question dobara bhejein.\n- Agar issue continue ho, to CPA Consultation use karein.\n\n### Follow-up Questions\n- Kaunsa NRI tax topic hum pehle cover karein?\n- Kya aapko DTAA documents ka checklist chahiye?",
  tamil:
    "### Answer\nNaan ippo live AI services-ai access panna mudiyala.\n\n### Key Tax Points\n- Ungal chat request receive aagiduchu.\n- Neenga general NRI tax planning steps continue panna mudiyum.\n- Urgent case-na CPA kitta consult pannunga.\n\n### Next Steps\n- 1-2 nimidam kazhichu unga kelviya thirumba anuppunga.\n- Issue continue aana CPA Consultation use pannunga.\n\n### Follow-up Questions\n- Endha NRI tax topic-ah first priority kudukkanum?\n- Ungalukku DTAA documents checklist venuma?",
  indonesian:
    "### Answer\nLayanan AI langsung sedang tidak tersedia sementara.\n\n### Key Tax Points\n- Pertanyaan Anda sudah diterima.\n- Anda tetap bisa lanjut dengan langkah perencanaan pajak NRI umum.\n- Untuk kasus mendesak, konsultasikan ke CPA.\n\n### Next Steps\n- Coba kirim ulang pertanyaan dalam 1-2 menit.\n- Jika tetap terjadi, gunakan CPA Consultation.\n\n### Follow-up Questions\n- Topik pajak NRI mana yang ingin diprioritaskan?\n- Apakah Anda ingin checklist dokumen DTAA?",
};

export const createGuestSessionId = () =>
  `guest-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const getGuestSessionId = () => {
  if (typeof window === "undefined") return "guest-browser";
  const existing = localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const nextValue = createGuestSessionId();
  localStorage.setItem(GUEST_SESSION_STORAGE_KEY, nextValue);
  return nextValue;
};

export const getChatRequestHeaders = () => {
  const headers: Record<string, string> = {
    [CHAT_GUEST_HEADER]: getGuestSessionId(),
  };
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const getStoredUserName = () => {
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

export const sanitizeRenderedReply = (text: string) =>
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

export const ensureVisibleReply = (text: string) => {
  const cleaned = sanitizeRenderedReply(text);
  return cleaned || "No reply was returned. Please try again.";
};

export const normalizeChatMessage = (message: unknown): ChatMessage | null => {
  if (!message || typeof message !== "object") return null;
  const candidate = message as { role?: string; content?: unknown; taxRuleTimelines?: unknown };
  return {
    role: candidate.role === "user" ? "user" : "ai",
    content: ensureVisibleReply(String(candidate.content || "")),
    taxRuleTimelines: Array.isArray(candidate.taxRuleTimelines)
      ? (candidate.taxRuleTimelines as TaxRuleTimelineItem[])
      : [],
  };
};

export const getSpeechRecognitionLanguage = (language: string) =>
  language === "hindi"
    ? "hi-IN"
    : language === "tamil"
      ? "ta-IN"
      : language === "indonesian"
        ? "id-ID"
        : "en-US";

export const getWidgetWelcomeMessage = (language: string, userName: string) => {
  const safeName = userName || "User";
  const template = widgetWelcomeByLanguage[(language as ChatLanguage) || "english"] || widgetWelcomeByLanguage.english;
  return template.replace("User", safeName);
};

export const getPageWelcomeMessage = (language: string, userName: string) => {
  const safeName = userName ? ` ${userName}` : "";
  const selected = (language as ChatLanguage) || "english";
  if (selected === "tamil") {
    return `Vanakkam${safeName}! Naan ungal AI chat assistant. DTAA vidhigal, NRI vari kelvigal, matrum vari thittamidhalil naan uthava tayaaraga irukkiren. Indru naan ungalukku eppadi uthavalam?`;
  }
  if (selected === "hindi") {
    return `Namaste${safeName}! Main aapka AI chat assistant hoon. DTAA niyamon, NRI tax prashnon, aur tax planning mein main aapki madad kar sakta hoon. Main aaj aapki kaise sahayata kar sakta hoon?`;
  }
  if (selected === "indonesian") {
    return `Halo${safeName}! Saya asisten chat AI Anda. Saya siap membantu Anda terkait regulasi DTAA, pertanyaan pajak NRI, dan perencanaan pajak. Bagaimana saya bisa membantu Anda hari ini?`;
  }
  return `Hi${safeName}! I am your AI chat assistant. I can help you with DTAA regulations, NRI tax queries, and tax planning. How can I assist you today?`;
};
