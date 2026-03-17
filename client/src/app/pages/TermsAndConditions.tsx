import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const sections = [
  {
    title: "1. Acceptance of Terms",
    points: [
      "By using this platform, you confirm that you are at least 18 years old.",
      "By using this platform, you agree to these Terms and Conditions.",
      "By using this platform, you will use the services in compliance with applicable laws.",
    ],
  },
  {
    title: "2. Services Provided",
    points: [
      "Nritax.ai provides AI-powered assistance for NRI tax queries.",
      "Nritax.ai provides general tax guidance and informational content.",
      "Nritax.ai provides CPA or CA consultation services if booked.",
      "These services are for informational purposes only and do not replace professional advice.",
    ],
  },
  {
    title: "3. User Responsibilities",
    points: [
      "You agree to provide accurate and complete information.",
      "You agree not to misuse the platform or attempt unauthorized access.",
      "You agree not to use the service for illegal or fraudulent activities.",
    ],
  },
  {
    title: "4. AI Usage Disclaimer",
    points: [
      "Responses are generated using artificial intelligence.",
      "Outputs may not always be accurate or complete.",
      "Users must independently verify information before making decisions.",
    ],
  },
  {
    title: "5. Payments and Pricing",
    points: [
      "All fees are clearly displayed before purchase.",
      "Payments must be made through authorized payment gateways.",
      "Pricing is subject to change without prior notice.",
    ],
  },
  {
    title: "6. Refund Policy",
    points: [
      "All refunds are governed by our Refund Policy. Please review it carefully before making any payment.",
    ],
  },
  {
    title: "7. Intellectual Property",
    points: [
      "All website content, branding, and materials are the property of Nritax.ai.",
      "You may not copy, reproduce, or distribute content without permission.",
    ],
  },
  {
    title: "8. Third-Party Services",
    points: [
      "We may integrate with third-party tools or services.",
      "We are not responsible for their performance, accuracy, or policies.",
    ],
  },
  {
    title: "9. Limitation of Liability",
    points: [
      "Nritax.ai shall not be liable for any direct or indirect damages arising from use of the platform.",
      "Nritax.ai shall not be liable for errors, omissions, or inaccuracies in AI-generated responses.",
      "Nritax.ai shall not be liable for financial or tax decisions made based on our content.",
    ],
  },
  {
    title: "10. Service Availability",
    points: [
      "We do not guarantee uninterrupted or error-free service.",
      "Services may be temporarily unavailable due to maintenance or technical issues.",
    ],
  },
  {
    title: "11. Termination of Access",
    points: [
      "We reserve the right to suspend or terminate user access at our discretion.",
      "We reserve the right to take action against misuse or violation of these terms.",
    ],
  },
  {
    title: "12. Privacy",
    points: [
      "Your use of our platform is also governed by our Privacy Policy.",
    ],
  },
  {
    title: "13. Changes to Terms",
    points: [
      "We may update these Terms and Conditions at any time.",
      "Continued use of the platform indicates acceptance of the updated terms.",
    ],
  },
  {
    title: "14. Governing Law",
    points: [
      "These Terms shall be governed by and interpreted in accordance with the laws of India.",
    ],
  },
  {
    title: "15. Contact Us",
    points: [
      "For any questions regarding these Terms, contact us at support@nritax.ai.",
    ],
  },
] as const;

export function TermsAndConditions() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Terms and Conditions</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">Last Updated: March 17, 2026</CardDescription>
          <p className="text-sm text-[#0F172A]">
            Welcome to Nritax.ai. By accessing or using our website, AI chatbot, or services, you agree to comply
            with and be bound by the following Terms and Conditions.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
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
