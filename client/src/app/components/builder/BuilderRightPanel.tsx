import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useBuilderStore } from "../../stores/builderStore";

export function BuilderRightPanel() {
  const activeTab = useBuilderStore((state) => state.activeTab);
  const setActiveTab = useBuilderStore((state) => state.setActiveTab);
  const previewUrl = useBuilderStore((state) => state.previewUrl);
  const logs = useBuilderStore((state) => state.logs);
  const proposedPatch = useBuilderStore((state) => state.proposedPatch);
  const files = useBuilderStore((state) => state.files);
  const selectedFile = useBuilderStore((state) => state.selectedFile);
  const setSelectedFile = useBuilderStore((state) => state.setSelectedFile);

  return (
    <Card className="h-full rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#0F172A]">Output Panel</CardTitle>
      </CardHeader>
      <CardContent className="h-[620px]">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "preview" | "code" | "logs")} className="h-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#3b82f6]">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-3 h-[560px]">
            <div className="h-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]">
              <iframe
                title="Builder Preview"
                src={previewUrl}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-3 h-[560px]">
            <div className="grid h-full grid-cols-[220px_1fr] gap-3">
              <ScrollArea className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 p-2">
                <div className="space-y-1">
                  {Object.keys(files).map((filePath) => (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => setSelectedFile(filePath)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                        selectedFile === filePath
                          ? "bg-[#3b82f6] text-[#0F172A]"
                          : "text-[#0F172A] hover:bg-[#3b82f6] hover:text-[#0F172A]"
                      }`}
                    >
                      {filePath}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <div className="grid grid-rows-[1fr_1fr] gap-3">
                <ScrollArea className="rounded-xl border border-[#E2E8F0] bg-[#3b82f6] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#0F172A]">File View</p>
                  <pre className="whitespace-pre-wrap text-xs text-[#0F172A]">{files[selectedFile]}</pre>
                </ScrollArea>
                <ScrollArea className="rounded-xl border border-[#E2E8F0] bg-[#3b82f6] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#0F172A]">Proposed Patch</p>
                  <pre className="whitespace-pre-wrap text-xs text-[#0F172A]">{proposedPatch}</pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-3 h-[560px]">
            <ScrollArea className="h-full rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 p-3">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F7FAFC]/80 px-3 py-2"
                  >
                    <p className="text-sm text-[#0F172A]">{log.message}</p>
                    <Badge className={log.level === "success" ? "bg-[#1d4ed8] text-[#2563eb]" : "bg-[#3b82f6] text-[#0F172A]"}>
                      {log.timestamp}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}









