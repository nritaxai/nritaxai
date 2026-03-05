import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Sparkles } from "lucide-react";
import { useBuilderStore } from "../../stores/builderStore";

const suggestionChips = [
  "Improve conversion-focused CTA hierarchy",
  "Tighten chat layout and quick actions",
  "Add premium trust strip below hero",
  "Reduce visual noise and improve readability",
];

export function BuilderPromptPanel() {
  const promptInput = useBuilderStore((state) => state.promptInput);
  const setPromptInput = useBuilderStore((state) => state.setPromptInput);
  const generateFromPrompt = useBuilderStore((state) => state.generateFromPrompt);
  const messages = useBuilderStore((state) => state.messages);
  const selectedTemplate = useBuilderStore((state) => state.selectedTemplate);

  const canGenerate = useMemo(() => promptInput.trim().length > 0, [promptInput]);

  return (
    <Card className="h-full rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base text-[#0F172A]">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#2563eb]" />
            Prompt Builder
          </span>
          <Badge className="bg-[#3b82f6] text-[#0F172A]">{selectedTemplate}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <ScrollArea className="h-[340px] rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/65 p-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-[#3b82f6] text-[#0F172A]"
                    : "bg-[#3b82f6] text-[#0F172A]"
                }`}
              >
                <p>{message.content}</p>
                <p className="mt-1 text-[11px] opacity-70">{message.timestamp}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-2">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPromptInput(chip)}
              className="rounded-full border border-[#E2E8F0] bg-[#3b82f6] px-3 py-1.5 text-xs text-[#0F172A] transition hover:bg-[#1d4ed8] hover:text-[#0F172A]"
            >
              {chip}
            </button>
          ))}
        </div>
      </CardContent>

      <CardFooter className="grid gap-3">
        <Input
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          placeholder="Describe the UI change you want to generate..."
          className="h-11 rounded-xl border-[#E2E8F0] bg-[#F7FAFC]/85"
          onKeyDown={(event) => {
            if (event.key === "Enter" && canGenerate) {
              event.preventDefault();
              void generateFromPrompt(promptInput);
            }
          }}
        />
        <Button
          onClick={() => void generateFromPrompt(promptInput)}
          disabled={!canGenerate}
          className="h-11 rounded-xl bg-[#2563eb] text-[#0F172A] hover:opacity-95"
        >
          Generate
        </Button>
      </CardFooter>
    </Card>
  );
}










