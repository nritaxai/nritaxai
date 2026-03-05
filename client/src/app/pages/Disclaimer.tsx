import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function Disclaimer() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Disclaimer</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            Information on this platform is provided for general guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#0F172A]">
          <p>
            NRITAX.AI provides educational and workflow support content and does not constitute
            legal, tax, audit, or investment advice by default.
          </p>
          <p>
            Users should consult qualified professionals before making final tax or financial
            decisions.
          </p>
          <p>
            While we strive for accuracy, we do not guarantee completeness or suitability for every
            case.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}


