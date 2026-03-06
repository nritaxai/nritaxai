import { Lock, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { motion } from "motion/react";

export function ComplianceStandards() {
  const standards = [
    {
      icon: Lock,
      title: "256-bit SSL Encryption",
      description: "Bank-grade security for all data transmission.",
    },
    {
      icon: Shield,
      title: "SOC 2 Standards",
      description: "Security and privacy controls aligned for SaaS operations.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/82">
        <CardHeader>
          <Badge className="w-fit bg-[#E2E8F0] text-[#0F172A]">Compliance</Badge>
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">Compliance and Security Controls</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">
            Your tax workflow is protected with structured security, governance, and process controls.
          </CardDescription>
        </CardHeader>
      </Card>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        {standards.map((standard) => {
          const Icon = standard.icon;
          return (
            <motion.div
              key={standard.title}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
            <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/78">
              <CardContent className="pt-6">
                <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[#E2E8F0] text-[#0F172A]">
                  <Icon className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#0F172A]">{standard.title}</h3>
                <p className="text-sm text-[#0F172A]">{standard.description}</p>
              </CardContent>
            </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}









