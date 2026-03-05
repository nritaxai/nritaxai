import { create } from "zustand";

export type BuilderTemplate = "Pricing" | "AI Chat" | "Dashboard" | "Compliance";
export type BuilderTab = "preview" | "code" | "logs";

type BuilderLogLevel = "info" | "success";

export interface BuilderLog {
  id: string;
  message: string;
  level: BuilderLogLevel;
  timestamp: string;
}

export interface BuilderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface BuilderState {
  selectedTemplate: BuilderTemplate;
  previewUrl: string;
  activeTab: BuilderTab;
  logs: BuilderLog[];
  proposedPatch: string;
  files: Record<string, string>;
  selectedFile: string;
  promptInput: string;
  messages: BuilderMessage[];
  projects: string[];
  setSelectedTemplate: (template: BuilderTemplate) => void;
  setActiveTab: (tab: BuilderTab) => void;
  setPromptInput: (value: string) => void;
  setSelectedFile: (filePath: string) => void;
  addLog: (message: string, level?: BuilderLogLevel) => void;
  clearLogs: () => void;
  generateFromPrompt: (prompt: string) => Promise<void>;
}

const templateUrlMap: Record<BuilderTemplate, string> = {
  Pricing: "/pricing",
  "AI Chat": "/chat",
  Dashboard: "/dashboard",
  Compliance: "/compliance",
};

const nowLabel = () => new Date().toLocaleTimeString();

const simulateDelay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const useBuilderStore = create<BuilderState>((set, get) => ({
  selectedTemplate: "Pricing",
  previewUrl: "/pricing",
  activeTab: "preview",
  logs: [
    {
      id: "log-init",
      message: "Builder initialized. Select a template and generate.",
      level: "info",
      timestamp: nowLabel(),
    },
  ],
  proposedPatch: `diff --git a/src/app/pages/Pricing.tsx b/src/app/pages/Pricing.tsx
@@ -42,6 +42,14 @@ export function Pricing() {
+  // Builder suggestion: strengthen premium CTA hierarchy
+  // 1. Move annual badge near plan title
+  // 2. Emphasize consultation block for conversion
+  // 3. Add trust copy below CTA
`,
  files: {
    "src/app/pages/Pricing.tsx": `export function Pricing() {\n  return <div>Pricing page</div>;\n}\n`,
    "src/app/components/AIChat.tsx": `export function AIChat() {\n  return <div>AI Chat</div>;\n}\n`,
    "src/app/pages/Dashboard.tsx": `export function Dashboard() {\n  return <div>Dashboard</div>;\n}\n`,
  },
  selectedFile: "src/app/pages/Pricing.tsx",
  promptInput: "",
  messages: [
    {
      id: "msg-init",
      role: "assistant",
      content:
        "I can help you plan UI updates safely. Describe the change and choose a template to preview.",
      timestamp: nowLabel(),
    },
  ],
  projects: ["NRITAX.AI", "NRITAX Mobile", "Internal Admin"],
  setSelectedTemplate: (template) =>
    set({
      selectedTemplate: template,
      previewUrl: templateUrlMap[template],
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPromptInput: (value) => set({ promptInput: value }),
  setSelectedFile: (filePath) => set({ selectedFile: filePath }),
  addLog: (message, level = "info") =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message,
          level,
          timestamp: nowLabel(),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
  generateFromPrompt: async (prompt) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const template = get().selectedTemplate;
    const idPrefix = Date.now().toString();
    set((state) => ({
      promptInput: "",
      activeTab: "logs",
      messages: [
        ...state.messages,
        { id: `msg-${idPrefix}-u`, role: "user", content: trimmed, timestamp: nowLabel() },
      ],
      logs: [
        ...state.logs,
        { id: `log-${idPrefix}-1`, message: "Planning update strategy...", level: "info", timestamp: nowLabel() },
      ],
    }));

    await simulateDelay(450);
    get().addLog("Generating patch from selected template...", "info");
    await simulateDelay(500);
    get().addLog("Validating constraints and route safety...", "info");
    await simulateDelay(450);
    get().addLog("Done. Proposed patch is ready.", "success");

    set((state) => ({
      proposedPatch: `# Template: ${template}\n# Prompt\n${trimmed}\n\n## Proposed patch\n- Refine ${template} layout hierarchy\n- Update CTA copy for clarity\n- Keep business logic untouched\n`,
      activeTab: "code",
      messages: [
        ...state.messages,
        {
          id: `msg-${idPrefix}-a`,
          role: "assistant",
          content: `Plan prepared for ${template}. Review Preview, Code, and Logs tabs.`,
          timestamp: nowLabel(),
        },
      ],
    }));
  },
}));


