import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  MessageSquare,
  Users,
  FileText,
  TrendingUp,
  Globe2,
  Clock
} from "lucide-react";
import { motion } from "motion/react";
import { renderTextWithShortForms } from "../utils/shortForms";

export function Features() {
  const features = [
    {
      icon: MessageSquare,
      title: "AI-Powered Assistance",
      description: "Get instant answers to complex tax queries using advanced AI trained on DTAA regulations and NRI tax laws.",
      color: "bg-[#2563eb] text-[#0F172A]"
    },
    {
      icon: Users,
      title: "Expert CPA Support",
      description: "Connect with certified CPAs specializing in NRI taxation for personalized tax planning and compliance.",
      color: "bg-[#2563eb] text-[#0F172A]"
    },
    {
      icon: Globe2,
      title: "Multi-Language Support",
      description: "Access our platform in English, Hindi, Tamil, and Indonesian for seamless communication.",
      color: "bg-[#2563eb] text-[#0F172A]"
    },
    {
      icon: FileText,
      title: "DTAA Expertise",
      description: "Navigate Double Taxation Avoidance Agreements between India and 90+ countries with confidence.",
      color: "bg-[#2563eb] text-[#0F172A]"
    },
    {
      icon: TrendingUp,
      title: "Tax Planning",
      description: "Optimize your tax liability with strategic planning tailored to your specific NRI situation.",
      color: "bg-[#2563eb] text-[#0F172A]"
    },
    {
      icon: Clock,
      title: "24/7 Availability",
      description: "Access AI assistance anytime, anywhere with average response time under 2 minutes.",
      color: "bg-[#2563eb] text-[#0F172A]"
    }
  ];

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#2563eb]/12 to-transparent rounded-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mb-12 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">Why NRITAX</p>
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">Why Choose NRITAX.AI?</h2>
        <p className="mx-auto max-w-2xl text-base font-normal text-slate-500">
          Comprehensive tax solutions designed specifically for Non-Resident Indians
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.08,
              delayChildren: 0.08,
            },
          },
        }}
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <Card className="group flex h-full flex-col border-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
                <CardHeader>
                  <div className={`inline-flex w-12 h-12 items-center justify-center rounded-lg shadow-md ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="size-6" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-[#0F172A]">{renderTextWithShortForms(feature.title)}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-sm font-normal leading-7 text-slate-600">
                    {renderTextWithShortForms(feature.description)}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}









