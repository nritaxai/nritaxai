type ChatStatusBannerProps = {
  message: string;
  tone?: "error" | "warning" | "info";
};

const toneClasses: Record<NonNullable<ChatStatusBannerProps["tone"]>, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function ChatStatusBanner({ message, tone = "info" }: ChatStatusBannerProps) {
  if (!message) return null;
  return <p className={`rounded-xl border px-3 py-2 text-sm ${toneClasses[tone]}`}>{message}</p>;
}
