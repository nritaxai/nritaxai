import { cn } from "../ui/utils";

type TypingIndicatorProps = {
  label?: string;
  className?: string;
};

export function TypingIndicator({ label = "Thinking through your tax question...", className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm", className)}>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.24s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.12s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-300" />
      </div>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
