import { Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface AuthGateCardProps {
  title: string;
  description: string;
  onRequireLogin: () => void;
  actionLabel?: string;
}

export function AuthGateCard({
  title,
  description,
  onRequireLogin,
  actionLabel = "Login / Sign Up",
}: AuthGateCardProps) {
  return (
    <div className="mx-auto w-full max-w-[980px] py-6">
      <div className="px-1">
        <Card className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC]/82 shadow-[0_20px_40px_rgba(63,56,82,0.08)]">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#3b82f6]">
              <Lock className="size-7 text-[#2563eb]" />
            </div>
            <h1 className="mb-3 text-3xl text-[#0F172A] sm:text-4xl">{title}</h1>
            <p className="mx-auto mb-7 max-w-2xl text-[#0F172A]">{description}</p>
            <Button onClick={onRequireLogin}>{actionLabel}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}








