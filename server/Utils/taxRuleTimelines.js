const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const normalizeDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatTimelineDate = (value) => {
  const parsed = normalizeDateInput(value);
  return parsed ? TIMELINE_DATE_FORMATTER.format(parsed) : "";
};

const buildPeriodLabel = (period) => {
  const startLabel = formatTimelineDate(period.effectiveStartDate);
  const endLabel = formatTimelineDate(period.effectiveEndDate);

  if (period.label) return period.label;
  if (startLabel && endLabel) return `${startLabel} to ${endLabel}`;
  if (startLabel) return `From ${startLabel}`;
  if (endLabel) return `Before ${endLabel}`;
  return "Current rule";
};

const taxRuleCatalog = [
  {
    id: "india-listed-equity-ltcg",
    ruleName: "India LTCG on listed equity",
    helperText: "Applicable rule depends on the transaction or sale date.",
    keywords: [
      /\bltcg\b/i,
      /\blong[\s-]?term capital gains?\b/i,
      /\bcapital gains?\b/i,
      /\blisted equity\b/i,
      /\bequity shares?\b/i,
      /\bequity mutual funds?\b/i,
    ],
    periods: [
      {
        value: "10% tax",
        rate: 0.1,
        exemption: 100000,
        threshold: 100000,
        effectiveStartDate: null,
        effectiveEndDate: "2026-03-31",
        active: false,
      },
      {
        value: "12.5% tax",
        rate: 0.125,
        exemption: 125000,
        threshold: 125000,
        effectiveStartDate: "2026-04-01",
        effectiveEndDate: null,
        active: true,
      },
    ],
  },
];

export const getTaxRuleTimelinesForQuery = (message = "") => {
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) return [];

  return taxRuleCatalog
    .filter((rule) => rule.keywords.some((pattern) => pattern.test(normalizedMessage)))
    .map((rule) => ({
      id: rule.id,
      ruleName: rule.ruleName,
      helperText: rule.helperText,
      periods: rule.periods.map((period) => ({
        ...period,
        label: buildPeriodLabel(period),
      })),
    }));
};

export const getCapitalGainsRuleTimelines = ({ holdingPeriod } = {}) => {
  if (holdingPeriod && holdingPeriod !== "long-term") return [];
  return getTaxRuleTimelinesForQuery("LTCG listed equity");
};

export const resolveApplicablePeriod = (periods = [], transactionDate) => {
  const normalizedTransactionDate = normalizeDateInput(transactionDate);
  if (!Array.isArray(periods) || !periods.length) return null;

  if (!normalizedTransactionDate) {
    return periods.find((period) => period.active) || periods[periods.length - 1];
  }

  return (
    periods.find((period) => {
      const start = normalizeDateInput(period.effectiveStartDate);
      const end = normalizeDateInput(period.effectiveEndDate);
      const startsBefore = !start || normalizedTransactionDate >= start;
      const endsAfter = !end || normalizedTransactionDate <= end;
      return startsBefore && endsAfter;
    }) ||
    periods.find((period) => period.active) ||
    periods[periods.length - 1]
  );
};

const formatMoney = (value) => {
  if (!Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const buildPeriodSummary = (period) => {
  const parts = [];
  if (period.value) parts.push(period.value);
  if (Number.isFinite(Number(period.exemption))) {
    parts.push(`${formatMoney(period.exemption)} exemption`);
  } else if (Number.isFinite(Number(period.threshold))) {
    parts.push(`${formatMoney(period.threshold)} threshold`);
  }
  return parts.join(", ");
};

export const buildTaxTimelineMarkdown = (timelines = []) => {
  if (!Array.isArray(timelines) || !timelines.length) return "";

  return timelines
    .map((timeline) => {
      const lines = [`#### ${timeline.ruleName}`];
      if (timeline.helperText) lines.push(timeline.helperText);
      lines.push(
        ...timeline.periods.map((period) => `- ${period.label}: ${buildPeriodSummary(period) || "Rule details updated"}`)
      );
      return lines.join("\n");
    })
    .join("\n\n");
};

export const appendTimelineToAnswer = (markdown = "", timelines = []) => {
  const timelineBlock = buildTaxTimelineMarkdown(timelines);
  if (!timelineBlock) return String(markdown || "").trim();

  const source = String(markdown || "").trim();
  const answerPattern = /(###\s*Answer\s*\n)([\s\S]*?)(?=\n###\s*|$)/i;
  const match = source.match(answerPattern);

  if (!match) {
    return `### Answer\n${timelineBlock}\n\n### Key Tax Points\n- Review the dated rule periods carefully.\n- Final tax depends on the exact transaction date.\n\n### Next Steps\n1. Confirm the transaction date.\n2. Apply the matching dated rule.\n\n### Follow-up Questions\n- What is the exact sale date?\n- Is this listed equity or another asset class?`;
  }

  const answerBody = String(match[2] || "").trim();
  if (answerBody.includes(timelineBlock)) return source;

  const updatedBody = `${answerBody}\n\n${timelineBlock}`.trim();
  return source.replace(answerPattern, `$1${updatedBody}\n`);
};
