import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Award, Check, Lock, Shield, Sparkles, X, Zap } from "lucide-react";
import { motion } from "motion/react";
import { AuthGateCard } from "../components/AuthGateCard";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { convertInrToCurrency, formatCurrency, formatInr, resolveCurrencyByCode, SUPPORTED_CURRENCIES } from "../../utils/currency";
import { GSTIN, IS_IOS_NATIVE_APP } from "../../config/appConfig";
import { getMySubscription, getStoredAuthToken } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";
import { CLIENT_PLAN_CONFIG, CLIENT_PLAN_ORDER, getPlanLabel, isCurrentPlan, type PlanKey, type SubscriptionMe } from "../../utils/subscription";

type BillingCycle = "monthly" | "yearly";

interface PricingProps {
  onRequireLogin: () => void;
}

export function Pricing({ onRequireLogin }: PricingProps) {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(typeof window !== "undefined" && getStoredAuthToken());
  const isIosNativeApp = IS_IOS_NATIVE_APP;
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionMe | null>(null);
  const [currencyOverride, setCurrencyOverride] = useState<string>(
    () => localStorage.getItem("pricing_currency_override") || "INR"
  );

  const plans = CLIENT_PLAN_ORDER.map((planKey) => {
    const config = CLIENT_PLAN_CONFIG[planKey];
    return {
      name: planKey,
      label: config.displayName,
      badge: config.badge,
      monthlyInr: config.monthlyPriceInr,
      yearlyInr: config.yearlyPriceInr,
      description:
        planKey === "starter"
          ? "Start with essential NRI tax tools and updates."
          : planKey === "professional"
          ? "For NRIs who need ongoing planning and faster support."
          : "Complete solution for high-touch tax and compliance needs.",
      cta:
        planKey === "starter"
          ? "Included"
          : planKey === "professional"
          ? "Continue to Checkout"
          : "Contact Enterprise",
      popular: planKey === "professional",
      features: config.pricingFeatures,
    };
  });

  const getMonthlyDisplay = (plan: { monthlyInr?: number | null; yearlyInr?: number | null }) => {
    if (typeof plan.monthlyInr !== "number") return null;
    if (billingCycle === "monthly") return plan.monthlyInr;
    if (typeof plan.yearlyInr !== "number") return plan.monthlyInr;
    return Math.round(plan.yearlyInr / 12);
  };

  const getYearlySavingsPercent = (monthlyInr?: number | null, yearlyInr?: number | null) => {
    if (typeof monthlyInr !== "number" || typeof yearlyInr !== "number" || monthlyInr <= 0) return 0;
    const monthlyCost = monthlyInr * 12;
    return Math.round(((monthlyCost - yearlyInr) / monthlyCost) * 100);
  };

  const displayCurrency = resolveCurrencyByCode(currencyOverride || "INR");
  const formatDisplayAmount = (inrValue: number) =>
    formatCurrency(convertInrToCurrency(inrValue, displayCurrency), displayCurrency, {
      minFractionDigits: 0,
      maxFractionDigits: 0,
    });
  const pricingCurrencyNote =
    displayCurrency.code === "INR"
      ? "Prices are billed in INR. Payment providers may convert this to your local currency and forex charges may apply."
      : `Prices are shown in ${displayCurrency.code}. Final payment is still charged in INR, and your bank or payment provider may apply conversion and forex charges.`;

  const getDisplayPriceLine = (inrValue: number) => {
    if (displayCurrency.code === "INR") {
      return formatInr(inrValue, { minFractionDigits: 0, maxFractionDigits: 0 });
    }
    return formatDisplayAmount(inrValue);
  };

  useEffect(() => {
    localStorage.setItem("pricing_currency_override", currencyOverride);
  }, [currencyOverride]);

  const handleCurrencyOverrideChange = (nextCurrency: string) => {
    localStorage.setItem("pricing_currency_override", nextCurrency);
    setCurrencyOverride(nextCurrency);
  };

  const handleSelect = async (planName: PlanKey) => {
    if (planName === "starter") {
      navigate("/home");
      return;
    }
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (isIosNativeApp) return;
    if (isCurrentPlan(subscription, planName)) return;

    if (planName === "professional") {
      navigate(`/checkout?plan=pro&currency=${encodeURIComponent(currencyOverride)}`);
      return;
    }

    window.location.href = "mailto:ask@nritax.ai?subject=Enterprise%20Plan%20Inquiry%20-%20NRITAX.AI";
  };

  const handleRestoreSubscription = async () => {
    setSyncMessage("");
    setIsSyncing(true);
    try {
      const data: any = await getMySubscription();
      const subscriptionDetails = data || null;
      setSubscription(subscriptionDetails);
      const isActivePaid = Boolean(
        subscriptionDetails?.subscriptionStatus === "active" && subscriptionDetails?.plan !== "starter"
      );
      setSyncMessage(
        isActivePaid
          ? `Subscription restored: ${getPlanLabel(subscriptionDetails?.plan)} plan is active.`
          : "No active paid subscription found for this account."
      );
      window.dispatchEvent(new Event("auth-changed"));
    } catch {
      setSyncMessage("Unable to sync subscription right now. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setSubscription(null);
      return;
    }
    getMySubscription()
      .then((data: any) => setSubscription(data || null))
      .catch(() => setSubscription(null));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Login to view pricing plans"
        description="Please sign in to compare plans and continue to secure checkout."
        onRequireLogin={onRequireLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mb-12 pt-8 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold text-[#0F172A] md:text-5xl">Simple, Transparent Pricing</h1>
        <p className="mb-8 text-lg text-[#475569] md:text-xl">Choose the plan that fits your needs</p>

        <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-md px-6 py-2 font-medium transition-all ${
              billingCycle === "monthly" ? "bg-blue-600 text-white shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`relative rounded-md px-6 py-2 font-medium transition-all ${
              billingCycle === "yearly" ? "bg-blue-600 text-white shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Yearly
            <span className="absolute -right-2 -top-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
              Save
            </span>
          </button>
        </div>
        <div className="mx-auto mt-4 max-w-xs text-left">
          <p className="mb-2 text-sm text-[#0F172A]">Display Currency</p>
          <Select value={currencyOverride} onValueChange={handleCurrencyOverrideChange}>
            <SelectTrigger className="bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mt-4 text-sm text-[#64748B]">{pricingCurrencyNote}</p>
      </motion.div>

      {isIosNativeApp && (
        <div className="mx-auto mb-8 max-w-4xl rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            Subscriptions can be purchased on our website. If you already subscribed, use sync below.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={handleRestoreSubscription} disabled={isSyncing}>
              {isSyncing ? "Syncing..." : "Sync/Restore Subscription"}
            </Button>
            {syncMessage ? <p className="text-sm text-blue-800">{syncMessage}</p> : null}
          </div>
        </div>
      )}

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
        }}
        className="mx-auto mb-16 grid max-w-6xl gap-6 px-4 md:grid-cols-3 md:gap-8 md:px-6"
      >
        {plans.map((plan) => {
          const monthlyDisplay = getMonthlyDisplay(plan);
          const yearlySavings = getYearlySavingsPercent(plan.monthlyInr, plan.yearlyInr);
          const isPopular = Boolean(plan.popular);
          const isActivePlan = isCurrentPlan(subscription, plan.name);
          const isButtonDisabled = isActivePlan;

          return (
            <motion.div
              key={plan.name}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-lg border p-8 transition-all ${
                isPopular
                  ? "scale-100 border-blue-600 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl md:scale-105"
                  : plan.name === "enterprise"
                  ? "border-2 border-blue-200 bg-white shadow-sm hover:shadow-lg"
                  : "bg-white shadow-sm hover:shadow-lg"
              }`}
            >
              {isPopular ? (
                <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-blue-500 px-6 py-2 text-sm font-bold text-white shadow-lg">
                  <Zap className="h-4 w-4" />
                  {plan.badge}
                </div>
              ) : isActivePlan ? (
                <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                  CURRENT PLAN
                </div>
              ) : plan.name === "enterprise" ? (
                <div className="absolute right-4 top-4 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">
                  {plan.badge}
                </div>
              ) : (
                <div className="mb-4 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-[#475569]">
                  {plan.badge}
                </div>
              )}

              <div className={isPopular ? "mb-6 mt-4" : "mb-6"}>
                <h3 className={`mb-2 text-2xl font-bold ${isPopular ? "text-white" : "text-[#0F172A]"}`}>{plan.label}</h3>
                <p className={`mb-3 text-sm ${isPopular ? "text-blue-100" : "text-[#64748B]"}`}>{renderTextWithShortForms(plan.description)}</p>
                {monthlyDisplay !== null ? (
                  <>
                    <div className="mb-2 flex items-baseline">
                      <span className={`text-5xl font-bold ${isPopular ? "text-white" : "text-[#0F172A]"}`}>
                        {getDisplayPriceLine(monthlyDisplay)}
                      </span>
                      <span className={`ml-2 ${isPopular ? "text-blue-100" : "text-[#64748B]"}`}>/ month</span>
                    </div>
                    {typeof plan.yearlyInr === "number" && (
                      <p className={`text-sm ${isPopular ? "text-blue-100" : "text-[#64748B]"}`}>
                        or {getDisplayPriceLine(plan.yearlyInr)} / year {yearlySavings > 0 ? `(save ${yearlySavings}%)` : ""}
                      </p>
                    )}
                    <p className={`mt-2 text-xs ${isPopular ? "text-blue-100" : "text-[#64748B]"}`}>All prices are exclusive of GST.</p>
                  </>
                ) : (
                  <div className="mb-2 text-4xl font-bold text-[#0F172A]">Custom</div>
                )}
              </div>

              <ul className="mb-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className={`mt-0.5 h-5 w-5 flex-shrink-0 ${isPopular ? "text-blue-300" : "text-blue-600"}`} />
                    ) : (
                      <X className={`mt-0.5 h-5 w-5 flex-shrink-0 ${isPopular ? "text-blue-300" : "text-gray-300"}`} />
                    )}
                    <span
                      className={
                        feature.included
                          ? isPopular
                            ? "text-white"
                            : "text-[#0F172A]"
                          : isPopular
                          ? "text-sm text-blue-200"
                          : "text-sm text-gray-400"
                      }
                    >
                      {renderTextWithShortForms(feature.text)}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.name)}
                disabled={isButtonDisabled}
                className={`block w-full rounded-md py-3 text-center font-semibold transition-all ${
                  isPopular
                    ? "bg-white text-blue-700 hover:bg-gray-50"
                    : plan.name === "enterprise"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "border border-blue-600 text-blue-600 hover:bg-blue-50"
                } ${isButtonDisabled ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {isActivePlan ? "Current Plan" : plan.cta}
                {plan.name === "professional" && !isActivePlan ? <ArrowRight className="ml-2 inline h-4 w-4" /> : null}
              </button>
              {isActivePlan ? (
                <p className={`mt-3 text-sm ${isPopular ? "text-blue-100" : "text-[#475569]"}`}>
                  Your current plan is active. You cannot select the same plan again.
                </p>
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>

      <div className="mx-auto mb-16 max-w-5xl px-4 md:px-6">
        <div className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <h2 className="mb-12 text-center text-2xl font-bold text-[#0F172A] md:text-3xl">Frequently Asked Questions</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#0F172A]">
                <Zap className="h-5 w-5 text-blue-600" />
                What happens after free messages are used?
              </h3>
              <p className="text-[#64748B]">Upgrade to Professional for unlimited chat or wait for monthly reset.</p>
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#0F172A]">
                <Shield className="h-5 w-5 text-blue-600" />
                Can I cancel anytime?
              </h3>
              <p className="text-[#64748B]">Yes, you can manage plan changes anytime from your account.</p>
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#0F172A]">
                <Award className="h-5 w-5 text-blue-600" />
                {renderTextWithShortForms("Are these prices in INR?")}
              </h3>
              <p className="text-[#64748B]">
                {renderTextWithShortForms("Yes, plans are billed in INR. Payment providers may apply currency conversion for international cards.")}
              </p>
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#0F172A]">
                <Lock className="h-5 w-5 text-blue-600" />
                Is payment secure?
              </h3>
              <p className="text-[#64748B]">Yes, payments are processed via secure encrypted checkout.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mb-16 max-w-4xl px-4 md:px-6">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-center text-white shadow-xl">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">Need help choosing a plan?</h2>
          <p className="mb-8 text-lg text-blue-100 md:text-xl">Our team can help you select the right option.</p>
          <a
            href="mailto:ask@nritax.ai?subject=Pricing%20Inquiry%20-%20NRITAX.AI"
            className="inline-block rounded-md bg-white px-8 py-4 text-lg font-semibold text-blue-700 transition-all hover:bg-gray-50"
          >
            Talk to Support
          </a>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-[#64748B]">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Secure Payment</span>
            </div>
              <div className="flex items-center gap-2 text-[#64748B]">
                <Lock className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{renderTextWithShortForms("256-bit SSL")}</span>
              </div>
              <div className="flex items-center gap-2 text-[#64748B]">
                <Award className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{renderTextWithShortForms("Trusted by NRIs")}</span>
              </div>
          </div>
          <p className="text-center text-sm text-[#64748B]">
            Prices are shown in INR. Additional forex charges may apply.
          </p>
          <p className="mt-2 text-center text-sm text-[#64748B]">
            GSTIN: {GSTIN}
          </p>
        </div>
      </div>
    </div>
  );
}

