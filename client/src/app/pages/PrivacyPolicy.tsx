import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const sections = [
  {
    title: "1. Information We Collect",
    points: [
      "Account information such as name, email address, and profile details.",
      "Usage information including pages visited, feature interactions, and device/browser metadata.",
      "Communication data when you contact support or request consultations.",
      "Payment and billing references processed through approved payment providers (we do not store full card details).",
    ],
  },
  {
    title: "2. How We Use Information",
    points: [
      "Provide and improve NRITAX.AI services, chat responses, and product features.",
      "Verify account access, maintain security, and prevent abuse or fraud.",
      "Process subscriptions, invoices, and customer support requests.",
      "Comply with applicable legal, tax, and regulatory requirements.",
    ],
  },
  {
    title: "3. Data Sharing",
    points: [
      "We may share data with trusted service providers (hosting, analytics, communication, payments) strictly for service delivery.",
      "We may disclose information when required by law, legal process, or to protect rights and safety.",
      "We do not sell your personal information to third parties.",
    ],
  },
  {
    title: "4. Data Retention",
    points: [
      "We retain personal data only as long as needed for service, contractual, compliance, and legitimate business purposes.",
      "You may request account deletion subject to legal and record-keeping obligations.",
    ],
  },
  {
    title: "5. Security",
    points: [
      "We use administrative, technical, and organizational safeguards to protect personal data.",
      "No system is completely secure, and users should also protect account credentials.",
    ],
  },
  {
    title: "6. Your Rights",
    points: [
      "You may request access, correction, or deletion of your personal data, where applicable.",
      "You may opt out of non-essential communications at any time.",
    ],
  },
  {
    title: "7. Contact",
    points: [
      "For privacy questions or requests, contact: support@nritax.ai",
    ],
  },
];

export function PrivacyPolicy() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Privacy Policy</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            Effective date: March 4, 2026
          </CardDescription>
          <p className="text-sm text-[#0F172A]">
            This Privacy Policy explains how NRITAX.AI collects, uses, and protects information when you use our platform.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC] p-4">
              <h2 className="text-lg font-semibold text-[#0F172A]">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#0F172A]">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}


