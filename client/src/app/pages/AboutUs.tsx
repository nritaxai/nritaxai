import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function AboutUs() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">About Us</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            NRITAX.AI helps Non-Resident Indians make tax decisions with clarity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#0F172A]">
          <p>
            We combine AI guidance with practical workflows to simplify cross-border tax planning,
            compliance tracking, and filing preparation.
          </p>
          <p>
            Our goal is to make tax support faster, more transparent, and easier to act on for NRIs.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}


