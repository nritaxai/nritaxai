import { getCapitalGainsRuleTimelines, resolveApplicablePeriod } from "../Utils/taxRuleTimelines.js";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
};

const roundTo2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const calculateSlabTax = (income) => {
  const slabs = [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ];

  let tax = 0;
  let previousLimit = 0;
  const breakdown = [];

  for (const slab of slabs) {
    if (income <= previousLimit) break;
    const taxableInSlab = Math.max(0, Math.min(income, slab.upTo) - previousLimit);
    const slabTax = taxableInSlab * slab.rate;
    breakdown.push({
      from: previousLimit + 1,
      to: Number.isFinite(slab.upTo) ? slab.upTo : null,
      rate: slab.rate,
      taxableAmount: roundTo2(taxableInSlab),
      tax: roundTo2(slabTax),
    });
    tax += slabTax;
    previousLimit = slab.upTo;
  }

  return { tax: roundTo2(tax), breakdown };
};

export const calculateIncomeTax = (req, res) => {
  try {
    const income = toNumber(req.body?.income);
    if (!Number.isFinite(income) || income < 0) {
      return res.status(400).json({
        success: false,
        message: "Income must be a non-negative number.",
      });
    }
    const taxableIncome = Math.max(0, income);
    const { tax: slabTax, breakdown } = calculateSlabTax(taxableIncome);
    const cess = roundTo2(slabTax * 0.04);
    const totalTax = roundTo2(slabTax + cess);

    return res.status(200).json({
      success: true,
      result: {
        income: roundTo2(taxableIncome),
        taxableIncome: roundTo2(taxableIncome),
        slabTax,
        cess,
        tax: totalTax,
        effectiveRate: taxableIncome > 0 ? roundTo2((totalTax / taxableIncome) * 100) : 0,
        breakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate income tax",
      error: error.message,
    });
  }
};

export const calculateCapitalGainsTax = (req, res) => {
  try {
    const purchasePrice = toNumber(req.body?.purchasePrice);
    const salePrice = toNumber(req.body?.salePrice);
    const period = req.body?.period === "short-term" ? "short-term" : "long-term";
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Purchase price must be a non-negative number.",
      });
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Sale price must be a non-negative number.",
      });
    }
    const gain = salePrice - purchasePrice;
    const saleDate = typeof req.body?.saleDate === "string" ? req.body.saleDate : "";
    const ruleTimelines = getCapitalGainsRuleTimelines({ holdingPeriod: period });
    const applicableRule = resolveApplicablePeriod(ruleTimelines[0]?.periods || [], saleDate);
    const rate =
      period === "long-term"
        ? Number.isFinite(Number(applicableRule?.rate))
          ? Number(applicableRule.rate)
          : 0.125
        : 0.2;
    const baseTax = gain > 0 ? gain * rate : 0;
    const cess = baseTax > 0 ? baseTax * 0.04 : 0;
    const tax = baseTax + cess;

    return res.status(200).json({
      success: true,
      result: {
        purchasePrice: roundTo2(purchasePrice),
        salePrice: roundTo2(salePrice),
        gain: roundTo2(gain),
        rate,
        baseTax: roundTo2(baseTax),
        cess: roundTo2(cess),
        tax: roundTo2(tax),
        saleDate: saleDate || null,
        taxRuleTimelines: ruleTimelines,
        applicableRule:
          applicableRule && period === "long-term"
            ? {
                ...applicableRule,
                helperText: ruleTimelines[0]?.helperText || "",
              }
            : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate capital gains tax",
      error: error.message,
    });
  }
};

export const calculateRentalIncomeTax = (req, res) => {
  try {
    const monthlyRent = toNumber(req.body?.monthlyRent);
    const expenses = toNumber(req.body?.expenses);
    if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
      return res.status(400).json({
        success: false,
        message: "Monthly rent must be a non-negative number.",
      });
    }
    if (!Number.isFinite(expenses) || expenses < 0) {
      return res.status(400).json({
        success: false,
        message: "Expenses must be a non-negative number.",
      });
    }
    const annualRent = monthlyRent * 12;
    const netIncome = annualRent - expenses;
    const baseTax = netIncome > 0 ? netIncome * 0.3 : 0;
    const cess = baseTax > 0 ? baseTax * 0.04 : 0;
    const tax = baseTax + cess;

    return res.status(200).json({
      success: true,
      result: {
        monthlyRent: roundTo2(monthlyRent),
        expenses: roundTo2(expenses),
        annualRent: roundTo2(annualRent),
        netIncome: roundTo2(Math.max(netIncome, 0)),
        baseTax: roundTo2(baseTax),
        cess: roundTo2(cess),
        tax: roundTo2(tax),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate rental income tax",
      error: error.message,
    });
  }
};
