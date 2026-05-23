import { useNavigate } from "react-router-dom";
import { ArrowRight, Linkedin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { fadeUp, fadeUpSoft, PREMIUM_EASE, staggerContainer } from "../utils/motion";

interface Expert {
  id: string;
  name: string;
  role: string;
  specialization: string;
  credentials: string[];
  experience: string;
  imageUrl: string;
  linkedinUrl: string;
}

const expertTeam: Expert[] = [
  {
    id: "expert-1",
    name: "Rajesh Venkataraman, CPA",
    role: "Senior Tax Partner",
    specialization: "India-Indonesia DTAA",
    credentials: ["CPA India", "Certified FEMA Advisor"],
    experience: "18+ years",
    imageUrl: "https://ui-avatars.com/api/?name=RV&background=2563eb&color=fff&size=96",
    linkedinUrl: "#",
  },
  {
    id: "expert-2",
    name: "Priya Sharma, CA",
    role: "International Tax Director",
    specialization: "NRI Property Taxation",
    credentials: ["CA India", "LLB (Tax Law)"],
    experience: "15+ years",
    imageUrl: "https://ui-avatars.com/api/?name=PS&background=7c3aed&color=fff&size=96",
    linkedinUrl: "#",
  },
  {
    id: "expert-3",
    name: "Arjun Krishnamurthy, MBA",
    role: "Investment Tax Specialist",
    specialization: "Capital Gains & ESOP",
    credentials: ["CFA", "Registered Tax Consultant"],
    experience: "12+ years",
    imageUrl: "https://ui-avatars.com/api/?name=AK&background=10b981&color=fff&size=96",
    linkedinUrl: "#",
  },
  {
    id: "expert-4",
    name: "Deepa Raghunathan, CPA",
    role: "Compliance Head",
    specialization: "ITR Filing & Assessment",
    credentials: ["CPA Indonesia", "ICAI Member"],
    experience: "10+ years",
    imageUrl: "https://ui-avatars.com/api/?name=DR&background=f59e0b&color=fff&size=96",
    linkedinUrl: "#",
  },
];

export function ExpertCouncil() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="nri-expert-council bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_22%,#ffffff_100%)] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Expert Council</p>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Meet the specialists behind the platform</h2>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-600">Certified professionals with decades of cross-border tax, FEMA, and NRI advisory experience.</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer(0.08, 0.08)}
          className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {expertTeam.map((expert) => (
            <motion.div
              key={expert.id}
              variants={fadeUpSoft}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { y: -5, boxShadow: "0 20px 36px rgba(15, 23, 42, 0.10)" }
              }
              transition={{ duration: 0.28, ease: PREMIUM_EASE }}
              className="nri-expert-card flex h-full flex-col rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,252,0.98))] p-6 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
            >
              <img src={expert.imageUrl} alt={expert.name} className="mx-auto mb-4 h-24 w-24 rounded-full border-4 border-white object-cover shadow-[0_18px_30px_rgba(15,23,42,0.14)]" />
              <h3 className="nri-expert-card__name mb-1 text-lg font-semibold text-slate-900">{expert.name}</h3>
              <p className="nri-expert-card__role mb-2 text-sm font-semibold text-blue-700">{expert.role}</p>
              <p className="nri-expert-card__specialization mb-3 text-sm font-normal leading-7 text-slate-700">{expert.specialization}</p>
              <div className="mb-3 flex flex-wrap justify-center gap-1">
                {expert.credentials.map((cred) => (
                  <span key={cred} className="nri-expert-card__credential rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {cred}
                  </span>
                ))}
              </div>
              <p className="nri-expert-card__experience mb-4 mt-auto text-xs font-medium text-slate-600">{expert.experience} experience</p>
              <a href={expert.linkedinUrl} className="nri-expert-card__connect inline-flex items-center justify-center gap-2 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-900">
                <Linkedin className="size-4" />
                Connect
              </a>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          variants={fadeUp}
          className="nri-expert-cta mt-10 rounded-[1.9rem] border border-blue-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-6 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)] md:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Join Our Team</p>
          <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Join the NRITAX expert network</h3>
          <p className="nri-expert-cta__copy mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-700">
            Are you a Chartered Accountant or cross-border tax specialist? Apply to support NRI users with tax,
            compliance, and advisory services.
          </p>
          <motion.button
            type="button"
            onClick={() => navigate("/join-as-expert")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)] transition-all hover:bg-blue-700"
            whileHover={
              shouldReduceMotion
                ? undefined
                : { y: -2, boxShadow: "0 18px 34px rgba(37, 99, 235, 0.22)" }
            }
            whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.25, ease: PREMIUM_EASE }}
          >
            Join Our Expert Team
            <ArrowRight className="size-4" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}


