import { LifeBuoy, Mail, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const supportOptions = [
  {
    title: "Email Support",
    description: "Share login, billing, AI response, or account issues with our team and get a tracked response.",
    actionLabel: "Email ask@nritax.ai",
    href: "mailto:ask@nritax.ai?subject=Support%20Request%20-%20NRITAX.AI",
    icon: Mail,
    external: true,
  },
  {
    title: "Send a Support Message",
    description: "Use our guided support flow if you want help with your account, subscriptions, or tax workflow questions.",
    actionLabel: "Open Support Form",
    href: "/consult",
    icon: MessageSquareText,
    external: false,
  },
  {
    title: "Talk to a Tax Expert",
    description: "Need deeper help with filings, DTAA, capital gains, or compliance? Reach the expert consultation page directly.",
    actionLabel: "Go to Expert Consult",
    href: "/consult",
    icon: LifeBuoy,
    external: false,
  },
] as const;

const supportTopics = [
  "Login or password recovery",
  "Billing, refunds, or subscription access",
  "NriTax AI chat quality or accuracy feedback",
  "Document upload and dashboard issues",
  "Consultation scheduling and follow-ups",
] as const;

export function Support() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[32px] border border-[#DBEAFE] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_42%),linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_55%,#F8FAFC_100%)] p-8 shadow-sm sm:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2563EB]">Support</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0F172A] sm:text-5xl">
            Get help with NriTax AI quickly
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Reach our support team for account access, billing questions, AI chat issues, document problems, or help
            finding the right next step inside the platform.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]">
              <a href="mailto:ask@nritax.ai?subject=Support%20Request%20-%20NRITAX.AI">Email Support</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[#BFDBFE] bg-white/80 text-[#1E3A8A]">
              <Link to="/consult">Open Support Form</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {supportOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Card key={option.title} className="rounded-3xl border-[#E2E8F0] bg-white shadow-sm">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="pt-4 text-2xl text-[#0F172A]">{option.title}</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600">
                  {option.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant={option.external ? "default" : "outline"} className="w-full">
                  {option.external ? (
                    <a href={option.href}>{option.actionLabel}</a>
                  ) : (
                    <Link to={option.href}>{option.actionLabel}</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-[#E2E8F0] bg-[#F8FAFC]">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F172A]">Best for these issues</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-600">
              Include the exact problem, any screenshots, and the email linked to your account so we can help faster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-[#0F172A]">
              {supportTopics.map((topic) => (
                <li key={topic} className="flex items-start gap-3 rounded-2xl border border-white bg-white px-4 py-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#E2E8F0] bg-[#0F172A] text-white">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Need priority help?</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-300">
              For filing deadlines, consultation scheduling, or urgent platform blockers, contact support directly and
              mention the deadline in your subject line.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-white">Primary support email</p>
              <a
                href="mailto:ask@nritax.ai?subject=Urgent%20Support%20-%20NRITAX.AI"
                className="mt-2 inline-block text-sm text-[#93C5FD] hover:underline"
              >
                ask@nritax.ai
              </a>
            </div>
            <Button asChild size="lg" className="w-full bg-white text-[#0F172A] hover:bg-slate-100">
              <a href="mailto:ask@nritax.ai?subject=Urgent%20Support%20-%20NRITAX.AI">Contact Support</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
