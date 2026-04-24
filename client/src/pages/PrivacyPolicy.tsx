const policySections = [
  {
    title: "Data Collected",
    points: [
      "Account details such as your name, email address, phone number, and login provider details when you create or access an account.",
      "Tax profile information you choose to provide, including residency, filing status, income details, and supporting notes used to personalize advisory guidance.",
      "Device and usage signals such as browser type, app version, IP-derived region, and diagnostic events that help us keep the service reliable.",
    ],
  },
  {
    title: "How It's Used",
    points: [
      "To deliver tax advisory workflows, generate personalized insights, and maintain your account session across the web and Android app.",
      "To support payments, customer support requests, security monitoring, fraud prevention, and service improvement.",
      "To comply with applicable legal, tax, accounting, and record-keeping obligations.",
    ],
  },
  {
    title: "Third Parties",
    points: [
      "We may rely on hosting, analytics, authentication, payment, communications, and document-processing providers that process data under contractual safeguards.",
      "We do not sell your personal information. Third parties only receive the information required to perform their service for NRITaxAI.",
      "If a regulator or lawful authority requires disclosure, we may share information when legally necessary.",
    ],
  },
  {
    title: "User Rights",
    points: [
      "You may request access, correction, export, or deletion of the personal data we hold about you, subject to legal retention obligations.",
      "You may also request that we limit certain processing activities or update inaccurate profile details.",
      "Marketing or product-update communications can be opted out of through the unsubscribe method provided in the message.",
    ],
  },
  {
    title: "Contact",
    points: [
      "For privacy questions, email support@nritax.ai and include enough detail for us to verify and process your request safely.",
      "If you contact us about account-specific data, we may ask for additional verification before making changes.",
    ],
  },
  {
    title: "Data Deletion Requests",
    points: [
      "To request deletion, email support@nritax.ai with the subject line 'Data Deletion Request' from the email linked to your account whenever possible.",
      "We will review the request, confirm your identity, and explain any information that must be retained for legal, fraud-prevention, or tax-record purposes.",
      "Where deletion is permitted, we will remove or anonymize the relevant data within a reasonable timeframe and confirm completion.",
    ],
  },
];

export function PrivacyPolicy() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 text-[#0F172A]">
      <section className="overflow-hidden rounded-[2rem] border border-[#D6E4F0] bg-[linear-gradient(135deg,#0F172A_0%,#1D4ED8_55%,#E0F2FE_100%)] px-6 py-10 text-white shadow-[0_28px_80px_rgba(15,23,42,0.22)] md:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Privacy Policy</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight md:text-5xl">
          How NRITaxAI handles your data across web and Android.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
          This policy applies to NRITaxAI&apos;s tax advisory products, including our website and Capacitor-based Android app.
          It explains what information may be collected, how it may be used, and how you can request access or deletion.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/78">
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Last updated: April 21, 2026</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Public URL required for Google Play</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2563EB]">Scope</p>
          <p className="mt-3 text-sm leading-7 text-[#334155]">
            Covers account creation, tax advisory interactions, checkout flows, support, and app diagnostics.
          </p>
        </article>
        <article className="rounded-3xl border border-[#DCFCE7] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#15803D]">Your Controls</p>
          <p className="mt-3 text-sm leading-7 text-[#334155]">
            You can request access, corrections, exports, or deletion by contacting the support team.
          </p>
        </article>
        <article className="rounded-3xl border border-[#FDE68A] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B45309]">Important</p>
          <p className="mt-3 text-sm leading-7 text-[#334155]">
            Some records may be retained when required for tax compliance, fraud prevention, or legal obligations.
          </p>
        </article>
      </section>

      <section className="space-y-5">
        {policySections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold text-[#0F172A]">{section.title}</h2>
            <div className="mt-4 space-y-3">
              {section.points.map((point) => (
                <p key={point} className="rounded-2xl bg-[#F8FAFC] px-4 py-3 text-sm leading-7 text-[#475569]">
                  {point}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-[#0F172A]">Public Privacy Policy URL</h2>
        <p className="mt-4 text-sm leading-7 text-[#475569]">
          For your Google Play listing, publish this route at a public HTTPS URL such as
          <span className="font-medium text-[#0F172A]"> https://nritax.ai/privacy-policy</span> so reviewers and users can access it without logging in.
        </p>
      </section>
    </main>
  );
}
