import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function AboutUs() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">About Us</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            NRITAX.AI is built with a single purpose: to simplify tax decision-making for Non-Resident Indians living and earning across borders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-7 text-[#0F172A]">
          <p>
            We understand that managing taxes in multiple countries can quickly become overwhelming. Different tax laws,
            changing regulations, compliance deadlines, and documentation requirements often create confusion and stress.
            Many NRIs struggle not because they lack financial awareness, but because the system itself is fragmented and
            hard to navigate.
          </p>
          <p>
            That is why we created NRITAX.AI, a smarter and more intuitive way to approach cross-border taxation.
          </p>
          <p>
            Our platform combines advanced AI-driven insights with practical, easy-to-follow workflows. Instead of just
            providing information, we guide you through what actually needs to be done. From understanding your tax
            obligations to tracking compliance requirements and preparing for filings, we help you move from confusion to
            clarity.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#0F172A]">Clarity</h2>
            <p>
              We break down complex tax concepts into simple, understandable insights so you always know where you stand
              and what comes next.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#0F172A]">Actionability</h2>
            <p>
              Our workflows are designed to help you take real steps, not just learn, but act with confidence.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#0F172A]">Transparency</h2>
            <p>
              No hidden complexity, no unnecessary jargon. Just clear guidance you can trust.
            </p>
          </div>

          <p>
            Whether you are earning income in India and abroad, investing across markets, or preparing for annual tax
            filings, NRITAX.AI is designed to support your journey end-to-end.
          </p>
          <p>
            We are not just building a tool, we are building a smarter way for NRIs to manage taxes with confidence,
            speed, and peace of mind.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#0F172A]">Our Vision</h2>
            <p>
              To become the most trusted digital tax companion for NRIs worldwide, making cross-border taxation effortless
              and accessible.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#0F172A]">Our Mission</h2>
            <p>
              To empower NRIs with intelligent tools and guided workflows that turn complex tax decisions into simple,
              confident actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}


