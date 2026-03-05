/**
 * Tax regulations dataset used by the legacy calculator page.
 */

export interface TaxSlab {
  limit: number;
  rate: number;
  description?: string;
}

export interface CountryTaxData {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  taxYear: string;
  residencyDays: number;
  residencyRules: string;
  taxSlabs: TaxSlab[];
  dtaaWithIndia: boolean;
  dtaaDetails: string;
  filingDeadline: string;
  specialNotes: string[];
}

export const TAX_REGULATIONS: Record<string, CountryTaxData> = {
  ID: {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    currencySymbol: "Rp",
    taxYear: "Calendar Year (Jan 1 - Dec 31)",
    residencyDays: 183,
    residencyRules: "183 days or more in a calendar year qualifies as tax resident",
    taxSlabs: [
      { limit: 60000000, rate: 0.05, description: "Up to Rp 60M" },
      { limit: 250000000, rate: 0.15, description: "Rp 60M - 250M" },
      { limit: 500000000, rate: 0.25, description: "Rp 250M - 500M" },
      { limit: Infinity, rate: 0.3, description: "Above Rp 500M" },
    ],
    dtaaWithIndia: true,
    dtaaDetails:
      "India-Indonesia DTAA provides tax credits for taxes paid in source country to avoid double taxation.",
    filingDeadline: "March 31 (individuals), April 30 (with tax advisor)",
    specialNotes: [
      "Non-residents taxed only on Indonesian-source income.",
      "NPWP (Tax Identification Number) required for residents.",
      "Tax rates may increase for non-NPWP holders.",
    ],
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    currencySymbol: "S$",
    taxYear: "Calendar Year (Jan 1 - Dec 31), assessed in following year",
    residencyDays: 183,
    residencyRules: "183 days or more in a calendar year or qualifying multi-year work stay",
    taxSlabs: [
      { limit: 20000, rate: 0.0, description: "Up to S$20,000" },
      { limit: 30000, rate: 0.02, description: "Next S$10,000" },
      { limit: 40000, rate: 0.035, description: "Next S$10,000" },
      { limit: 80000, rate: 0.07, description: "Next S$40,000" },
      { limit: 120000, rate: 0.115, description: "Next S$40,000" },
      { limit: 160000, rate: 0.15, description: "Next S$40,000" },
      { limit: 200000, rate: 0.18, description: "Next S$40,000" },
      { limit: 240000, rate: 0.19, description: "Next S$40,000" },
      { limit: 280000, rate: 0.195, description: "Next S$40,000" },
      { limit: 320000, rate: 0.2, description: "Next S$40,000" },
      { limit: 500000, rate: 0.22, description: "Next S$180,000" },
      { limit: 1000000, rate: 0.23, description: "Next S$500,000" },
      { limit: Infinity, rate: 0.24, description: "Above S$1,000,000" },
    ],
    dtaaWithIndia: true,
    dtaaDetails:
      "India-Singapore DTAA offers tax credit mechanisms and withholding tax relief in many cases.",
    filingDeadline: "April 15 (paper), April 18 (e-filing)",
    specialNotes: [
      "No capital gains tax in Singapore.",
      "Foreign-sourced income treatment varies by conditions.",
    ],
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    currencySymbol: "RM",
    taxYear: "Calendar Year (Jan 1 - Dec 31)",
    residencyDays: 182,
    residencyRules: "182 days or more in a calendar year",
    taxSlabs: [
      { limit: 5000, rate: 0.0, description: "Up to RM 5,000" },
      { limit: 20000, rate: 0.01, description: "Next RM 15,000" },
      { limit: 35000, rate: 0.03, description: "Next RM 15,000" },
      { limit: 50000, rate: 0.06, description: "Next RM 15,000" },
      { limit: 70000, rate: 0.11, description: "Next RM 20,000" },
      { limit: 100000, rate: 0.19, description: "Next RM 30,000" },
      { limit: 250000, rate: 0.25, description: "Next RM 150,000" },
      { limit: 400000, rate: 0.26, description: "Next RM 150,000" },
      { limit: 600000, rate: 0.28, description: "Next RM 200,000" },
      { limit: 1000000, rate: 0.28, description: "Next RM 400,000" },
      { limit: 2000000, rate: 0.28, description: "Next RM 1,000,000" },
      { limit: Infinity, rate: 0.3, description: "Above RM 2,000,000" },
    ],
    dtaaWithIndia: true,
    dtaaDetails:
      "India-Malaysia DTAA includes relief from double taxation through credit/exemption methods.",
    filingDeadline: "April 30 / June 30",
    specialNotes: [
      "Non-residents may be taxed at flat rates on specific income types.",
      "Resident reliefs and deductions are available.",
    ],
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    taxYear: "Calendar Year (Jan 1 - Dec 31)",
    residencyDays: 183,
    residencyRules:
      "Substantial Presence Test: 31 days current year and weighted 183-day test across 3 years",
    taxSlabs: [
      { limit: 11600, rate: 0.1, description: "Up to $11,600" },
      { limit: 47150, rate: 0.12, description: "$11,601 - $47,150" },
      { limit: 100525, rate: 0.22, description: "$47,151 - $100,525" },
      { limit: 191950, rate: 0.24, description: "$100,526 - $191,950" },
      { limit: 243725, rate: 0.32, description: "$191,951 - $243,725" },
      { limit: 609350, rate: 0.35, description: "$243,726 - $609,350" },
      { limit: Infinity, rate: 0.37, description: "Above $609,350" },
    ],
    dtaaWithIndia: true,
    dtaaDetails:
      "India-US DTAA supports foreign tax credit and has special provisions for specific income classes.",
    filingDeadline: "April 15 (extension to October 15 possible)",
    specialNotes: [
      "US citizens are generally taxed on worldwide income.",
      "State taxes can apply separately.",
    ],
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    currencySymbol: "GBP",
    taxYear: "Tax Year (April 6 - April 5)",
    residencyDays: 183,
    residencyRules: "183 days or more in UK tax year (statutory test can be complex)",
    taxSlabs: [
      { limit: 12570, rate: 0.0, description: "Personal Allowance (up to GBP 12,570)" },
      { limit: 50270, rate: 0.2, description: "Basic rate" },
      { limit: 125140, rate: 0.4, description: "Higher rate" },
      { limit: Infinity, rate: 0.45, description: "Additional rate" },
    ],
    dtaaWithIndia: true,
    dtaaDetails:
      "India-UK DTAA provides relief via tax credits and allocates taxing rights by income type.",
    filingDeadline: "October 31 (paper), January 31 (online)",
    specialNotes: [
      "National Insurance is separate from income tax.",
      "Scotland uses different income tax bands.",
    ],
  },
};

export const COUNTRY_LIST = [
  { code: "ID", name: "Indonesia" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
] as const;

export type CountryCode = (typeof COUNTRY_LIST)[number]["code"];

export function getTaxData(countryCode: CountryCode): CountryTaxData {
  return TAX_REGULATIONS[countryCode];
}

export function calculateTax(income: number, countryCode: CountryCode): number {
  const taxData = getTaxData(countryCode);
  let tax = 0;
  let remaining = income;
  let previousLimit = 0;

  for (const slab of taxData.taxSlabs) {
    if (remaining <= 0) break;
    const taxableInThisSlab = Math.min(remaining, slab.limit - previousLimit);
    tax += taxableInThisSlab * slab.rate;
    remaining -= taxableInThisSlab;
    previousLimit = slab.limit;
  }

  return tax;
}

export function getTaxSlabDescription(income: number, countryCode: CountryCode): string {
  const taxData = getTaxData(countryCode);
  for (const slab of taxData.taxSlabs) {
    if (income <= slab.limit) {
      return slab.description || `${(slab.rate * 100).toFixed(1)}%`;
    }
  }
  const lastSlab = taxData.taxSlabs[taxData.taxSlabs.length - 1];
  return lastSlab.description || `${(lastSlab.rate * 100).toFixed(1)}%`;
}

export function formatCurrency(amount: number, countryCode: CountryCode): string {
  const taxData = getTaxData(countryCode);
  const locales: Record<CountryCode, string> = {
    ID: "id-ID",
    SG: "en-SG",
    MY: "ms-MY",
    US: "en-US",
    GB: "en-GB",
  };
  return new Intl.NumberFormat(locales[countryCode], {
    style: "currency",
    currency: taxData.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

