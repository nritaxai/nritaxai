import { Linkedin } from "lucide-react";

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
  return (
    <section className="bg-gray-50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-3xl font-bold text-slate-900">Meet Your Expert Council</h2>
          <p className="text-lg text-slate-600">Certified professionals with decades of cross-border tax expertise</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {expertTeam.map((expert) => (
            <div key={expert.id} className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-lg">
              <img src={expert.imageUrl} alt={expert.name} className="mx-auto mb-4 h-24 w-24 rounded-full object-cover" />
              <h3 className="mb-1 text-lg font-semibold text-slate-900">{expert.name}</h3>
              <p className="mb-2 text-sm font-medium text-blue-600">{expert.role}</p>
              <p className="mb-3 text-sm text-slate-600">{expert.specialization}</p>
              <div className="mb-3 flex flex-wrap justify-center gap-1">
                {expert.credentials.map((cred) => (
                  <span key={cred} className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    {cred}
                  </span>
                ))}
              </div>
              <p className="mb-4 text-xs text-slate-500">{expert.experience} experience</p>
              <a href={expert.linkedinUrl} className="inline-flex items-center gap-2 text-sm text-blue-600 transition-colors hover:text-blue-800">
                <Linkedin className="size-4" />
                Connect
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


