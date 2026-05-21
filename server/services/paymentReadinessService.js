import { featureFlags } from "../Config/featureFlags.js";

export const CHECKOUT_DISPLAY_CURRENCIES = ["INR", "USD", "SGD", "IDR", "GBP", "AED", "CAD"];
export const GATEWAY_CHARGE_CURRENCIES = ["INR"];

export const buildPaymentReadinessReport = () => {
  const risks = [];

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    risks.push("Razorpay API credentials are missing.");
  }
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    risks.push("Webhook secret is missing, which weakens payment event verification.");
  }
  if (!featureFlags.paymentReliabilityEnabled) {
    risks.push("Payment reliability tracking is disabled.");
  }
  if (!featureFlags.paymentReconciliationEnabled) {
    risks.push("Payment reconciliation workflow is disabled.");
  }
  if (GATEWAY_CHARGE_CURRENCIES.length === 1 && GATEWAY_CHARGE_CURRENCIES[0] === "INR") {
    risks.push("Gateway charging is currently limited to INR settlement even when international cards are used.");
  }

  return {
    provider: "razorpay",
    supportedDisplayCurrencies: CHECKOUT_DISPLAY_CURRENCIES,
    supportedChargeCurrencies: GATEWAY_CHARGE_CURRENCIES,
    supportedPricingCountries: ["IN", "US", "GB", "AE", "SG", "CA", "AU"],
    internationalCardSupport: "requires_provider_account_configuration",
    nonInrCheckout: "display_supported_charge_in_inr_only",
    foreignRemittanceHandling: "tracked_via_billing_country_and_tax_classification",
    webhookReliability: featureFlags.paymentReliabilityEnabled ? "audited_and_deduplicated" : "basic",
    reconciliationFlow: featureFlags.paymentReconciliationEnabled ? "available" : "disabled",
    settlementHandling: "inr_primary_settlement",
    retryMechanisms: {
      verificationRetry: true,
      webhookDeduplication: true,
      recoveryQueue: featureFlags.paymentReconciliationEnabled,
    },
    riskLevel: risks.length ? "medium" : "low",
    risks,
  };
};
