import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { FolderKanban, LayoutTemplate } from "lucide-react";
import { useBuilderStore } from "../../stores/builderStore";
import type { BuilderTemplate } from "../../stores/builderStore";

const templates: BuilderTemplate[] = ["Pricing", "AI Chat", "Dashboard", "Compliance"];

export function BuilderSidebar() {
  const selectedTemplate = useBuilderStore((state) => state.selectedTemplate);
  const setSelectedTemplate = useBuilderStore((state) => state.setSelectedTemplate);
  const projects = useBuilderStore((state) => state.projects);

  return (
    <Card className="h-full rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-[#0F172A]">
          <LayoutTemplate className="size-4 text-[#2563eb]" />
          Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {templates.map((template) => (
            <Button
              key={template}
              variant="ghost"
              onClick={() => setSelectedTemplate(template)}
              className={`w-full justify-start rounded-xl border ${
                selectedTemplate === template
                  ? "border-[#2563eb] bg-[#3b82f6] text-[#0F172A]"
                  : "border-transparent text-[#0F172A] hover:border-[#E2E8F0] hover:bg-[#3b82f6] hover:text-[#0F172A]"
              }`}
            >
              {template}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
            <FolderKanban className="size-4 text-[#2563eb]" />
            Projects
          </div>
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project}
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 px-3 py-2"
              >
                <span className="truncate text-sm text-[#0F172A]">{project}</span>
                <Badge className="bg-[#1d4ed8] text-[#2563eb]">Live</Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}








