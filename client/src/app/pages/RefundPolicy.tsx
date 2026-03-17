import { CONTACT_WHATSAPP } from "../../config/appConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const sections = [
  {
    title: "1. No Refund on Completed Services",
    points: [
      "Once a service has been successfully delivered, including AI-generated responses, tax consultations, or advisory sessions, no refunds will be issued.",
    ],
  },
  {
    title: "2. Cancellation Before Service Delivery",
    points: [
      "If you cancel a paid service before it is initiated, you may be eligible for a full or partial refund.",
      "Cancellation requests must be submitted within 24 hours of booking.",
    ],
  },
  {
    title: "3. CPA Consultation Refunds",
    points: [
      "If a CPA consultation is rescheduled or canceled by us, you are eligible for a full refund or rescheduling at no extra cost.",
      "If you fail to attend the scheduled consultation, no refund will be provided.",
    ],
  },
  {
    title: "4. Duplicate Payments",
    points: [
      "In case of accidental duplicate payments, the extra amount will be fully refunded within 5 to 7 business days.",
    ],
  },
  {
    title: "5. Technical Errors",
    points: [
      "If a payment is deducted but the service is not delivered due to a technical issue, you will receive either a full refund or immediate access to the service.",
    ],
  },
  {
    title: "6. Refund Processing",
    points: [
      "Approved refunds will be processed within 5 to 10 business days.",
      "The refund will be credited to the original payment method.",
    ],
  },
  {
    title: "7. Non-Refundable Cases",
    points: [
      "Refunds will not be provided for a change of mind after service delivery.",
      "Refunds will not be provided when incorrect information is provided by the user.",
      "Refunds will not be provided for delays caused by incomplete user inputs.",
      "Refunds will not be provided for dissatisfaction without valid service failure.",
    ],
  },
  {
    title: "8. Contact for Refund Requests",
    points: [
      "For any refund-related queries, please contact us at support@nritax.ai.",
      `Contact Number: ${CONTACT_WHATSAPP}`,
    ],
  },
  {
    title: "9. Policy Updates",
    points: [
      "We reserve the right to update this Refund Policy at any time. Changes will be posted on this page.",
    ],
  },
] as const;

export function RefundPolicy() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Refund Policy</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">Last Updated: March 17, 2026</CardDescription>
          <p className="text-sm text-[#0F172A]">
            At Nritax.ai, we strive to provide high-quality AI-driven tax assistance and professional consultation services.
            Please read our refund policy carefully before making any purchase.
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
