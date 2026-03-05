import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const sections = [
  "By using NRITAX.AI, you agree to use the platform lawfully and provide accurate information.",
  "Service content is for informational assistance and does not automatically replace licensed professional advice.",
  "You are responsible for account security, including password and access control.",
  "Subscription, billing, and plan terms are governed by the selected plan at checkout.",
  "We may update features and policies periodically; continued use indicates acceptance of updates.",
];

export function TermsAndConditions() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Terms & Conditions</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">Effective date: March 4, 2026</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#0F172A]">
            {sections.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}


