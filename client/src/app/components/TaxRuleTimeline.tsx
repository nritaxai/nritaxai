import { Badge } from "./ui/badge";

export interface TaxRulePeriod {
  label?: string;
  value?: string;
  rate?: number;
  exemption?: number;
  threshold?: number;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  active?: boolean;
}

export interface TaxRuleTimelineItem {
  id: string;
  ruleName: string;
  helperText?: string;
  periods: TaxRulePeriod[];
}

const formatCurrency = (value?: number) => {
  if (!Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const getPeriodFacts = (period: TaxRulePeriod) => {
  const facts: string[] = [];
  if (period.value) facts.push(period.value);
  if (Number.isFinite(Number(period.exemption))) facts.push(`${formatCurrency(period.exemption)} exemption`);
  else if (Number.isFinite(Number(period.threshold))) facts.push(`${formatCurrency(period.threshold)} threshold`);
  return facts;
};

interface TaxRuleTimelineProps {
  timelines?: TaxRuleTimelineItem[];
  compact?: boolean;
}

export function TaxRuleTimeline({ timelines = [], compact = false }: TaxRuleTimelineProps) {
  if (!timelines.length) return null;

  return (
    <div className={`space-y-3 ${compact ? "mt-2" : "mt-3"}`}>
      {timelines.map((timeline) => (
        <div
          key={timeline.id}
          className="rounded-2xl border border-[#CBD5E1] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] p-3 sm:p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">{timeline.ruleName}</p>
            <Badge className="border border-[#BFDBFE] bg-[#DBEAFE] text-[#1D4ED8]">
              Date-aware rule
            </Badge>
          </div>
          {timeline.helperText ? (
            <p className="mt-2 text-xs text-[#475569]">{timeline.helperText}</p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {timeline.periods.map((period, index) => (
              <div
                key={`${timeline.id}-${period.label || index}`}
                className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3"
              >
                <p className="text-sm font-semibold text-[#0F172A]">{period.label || "Applicable period"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getPeriodFacts(period).map((fact) => (
                    <span
                      key={fact}
                      className="inline-flex rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]"
                    >
                      {fact}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
