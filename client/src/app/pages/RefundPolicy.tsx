import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function RefundPolicy() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Refund Policy</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">Effective date: March 4, 2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#0F172A]">
          <p>
            Subscription charges are generally non-refundable once a billing cycle starts, unless
            required by law or explicitly stated in your plan terms.
          </p>
          <p>
            If you believe you were billed in error, contact support@nritax.ai with payment details
            and we will review the case promptly.
          </p>
          <p>
            Approved refunds are processed through the original payment method and timelines depend
            on your payment provider.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}


