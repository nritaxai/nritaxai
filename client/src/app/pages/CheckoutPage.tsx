import React, { useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { CheckCircle2, CreditCard, Lock, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { buildApiUrl, clearStoredAuth } from "../../utils/api";
import {
  convertInrToCurrency,
  formatCurrency,
  formatInr,
  resolveCurrencyByCode,
  resolveCurrencyByCountry,
  SUPPORTED_CURRENCIES,
} from "../../utils/currency";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";

type BillingType = "monthly" | "yearly";
type PlanType = "pro";
type PromoCode = {
  code: string;
  discountPercent: number;
  description: string;
  billing?: BillingType;
};
type UserPayload = {
  name?: string;
  email?: string;
  countryOfResidence?: string;
};

const PROMO_CODES: PromoCode[] = [
  { code: "SANDBOX10", discountPercent: 10, description: "10% off on any plan (test only)" },
  { code: "SANDBOX20", discountPercent: 20, description: "20% off on any plan (test only)" },
  { code: "SANDBOXY25", discountPercent: 25, description: "25% off on yearly billing (test only)", billing: "yearly" },
  { code: "SANDBOX15", discountPercent: 15, description: "15% off on any plan (test only)" },
];

const PLAN_META: Record<
  PlanType,
  { label: string; monthlyPrice: number; yearlyPrice: number; badge?: string }
> = {
  pro: {
    label: "Professional Plan",
    monthlyPrice: 999,
    yearlyPrice: 9999,
    badge: "MOST POPULAR",
  },
};

const normalizePlan = (value: string | null): PlanType => {
  return "pro";
};

const normalizeGeoKey = (value: string) => value.trim().toLowerCase();
const isIndiaCountry = (value: string) => ["india", "in", "bharat"].includes(normalizeGeoKey(value));
const isValidCountryCode = (value: string) => /^\+\d{1,4}$/.test(value.trim());
const stripLeadingCountryCode = (phoneValue: string, countryCodeValue: string) => {
  const raw = String(phoneValue || "").trimStart();
  const code = String(countryCodeValue || "").trim();
  if (!raw || !code) return phoneValue;
  if (raw.startsWith(code)) {
    return raw.slice(code.length).trimStart();
  }
  return phoneValue;
};
const COUNTRY_CODE_OPTIONS = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States/Canada (+1)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+971", label: "UAE (+971)" },
];

const resolveCountryCodeByCountry = (country: string) => {
  const key = normalizeGeoKey(country);
  if (["india", "in", "bharat"].includes(key)) return "+91";
  if (["united states", "usa", "us", "america", "canada", "ca"].includes(key)) return "+1";
  if (["singapore", "sg"].includes(key)) return "+65";
  if (["indonesia", "id"].includes(key)) return "+62";
  if (["united kingdom", "uk", "great britain"].includes(key)) return "+44";
  if (["uae", "united arab emirates", "dubai", "abu dhabi"].includes(key)) return "+971";
  return "";
};

const buildReferralCode = (user: Record<string, unknown>) => {
  const raw = String(user?._id || user?.id || user?.email || "").toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9]/g, "");
  const base = cleaned.slice(-8).padStart(8, "0");
  return `NRI${base}`;
};

const resolveStoredCheckoutCurrency = (value: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as (typeof SUPPORTED_CURRENCIES)[number])
    ? normalized
    : "USD";
};

const loadRazorpayScript = async () => {
  if ((window as any).Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface CheckoutPageProps {
  onRequireLogin: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ onRequireLogin }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isIosNativeApp = IS_IOS_NATIVE_APP;
  const currencyFromQuery = searchParams.get("currency");
  const hasSyncedCurrencyFromQuery = useRef(false);

  const [plan, setPlan] = useState<PlanType>(normalizePlan(searchParams.get("plan")));
  const [billing, setBilling] = useState<BillingType>("monthly");
  const [promo, setPromo] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("auto");
  const [gstNumber, setGstNumber] = useState<string>("");
  const [referralUserCode, setReferralUserCode] = useState<string>("");
  const [billingCountry, setBillingCountry] = useState<string>("");
  const [billingState, setBillingState] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token"))
  );
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoMessage, setPromoMessage] = useState<string>("");
  const [promoError, setPromoError] = useState<string>("");
  const [checkoutError, setCheckoutError] = useState<string>("");
  const [sessionMessage, setSessionMessage] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasPrefilledUser, setHasPrefilledUser] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");
  const [currencyOverride, setCurrencyOverride] = useState<string>(
    () => resolveStoredCheckoutCurrency(currencyFromQuery || localStorage.getItem("pricing_currency_override"))
  );

  const selectedPlan = PLAN_META[plan];
  const price = billing === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice;
  const discountAmount = appliedPromo
    ? Number(((price * appliedPromo.discountPercent) / 100).toFixed(2))
    : 0;
  const finalTotal = Number((price - discountAmount).toFixed(2));
  const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  let storedUser: Record<string, unknown> = {};
  try {
    storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
  } catch {
    storedUser = {};
  }
  const userCountry = String(storedUser?.countryOfResidence || "");
  const effectiveCurrencyCountry = String(billingCountry || userCountry).trim();
  const countryCurrency = resolveCurrencyByCountry(effectiveCurrencyCountry);
  const displayCurrency = resolveCurrencyByCode(currencyOverride || countryCurrency.code);
  const isIndiaBilling = isIndiaCountry(billingCountry);
  const autoCountryCode = resolveCountryCodeByCountry(billingCountry || userCountry);
  const selectedCountryCode = countryCode === "auto" ? autoCountryCode : countryCode;
  const formatDisplayAmount = (inrValue: number) =>
    formatCurrency(convertInrToCurrency(inrValue, displayCurrency), displayCurrency);
  const displayCurrencyHeadline =
    displayCurrency.code === "INR"
      ? "Prices are shown in INR."
      : `Prices are shown in ${displayCurrency.code}.`;
  const billingCurrencyHeadline =
    displayCurrency.code === "INR"
      ? "Final billed amount will be charged in INR."
      : "Final billed amount will still be charged in INR by Razorpay and may be converted by your payment provider.";

  React.useEffect(() => {
    localStorage.setItem("pricing_currency_override", currencyOverride);
  }, [currencyOverride]);

  const handleCurrencyOverrideChange = (nextCurrency: string) => {
    localStorage.setItem("pricing_currency_override", nextCurrency);
    setCurrencyOverride(nextCurrency);
  };

  React.useEffect(() => {
    if (!isIndiaBilling && currencyOverride === "INR") {
      setCurrencyOverride("USD");
    }
  }, [isIndiaBilling, currencyOverride]);

  React.useEffect(() => {
    const syncAuth = () => setIsAuthenticated(Boolean(localStorage.getItem("token")));
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-changed", syncAuth);
    };
  }, []);

  React.useEffect(() => {
    setPlan(normalizePlan(searchParams.get("plan")));
  }, [searchParams]);

  React.useEffect(() => {
    if (!currencyFromQuery || hasSyncedCurrencyFromQuery.current) return;
    hasSyncedCurrencyFromQuery.current = true;
    const nextCurrency = resolveStoredCheckoutCurrency(currencyFromQuery);
    localStorage.setItem("pricing_currency_override", nextCurrency);
    setCurrencyOverride(nextCurrency);
  }, [currencyFromQuery]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setHasPrefilledUser(false);
      return;
    }
    if (hasPrefilledUser) return;

    const storedUserRaw = localStorage.getItem("user");
    if (!storedUserRaw) return;

    try {
      const storedUser = JSON.parse(storedUserRaw) as UserPayload;
      setFullName((prev) => prev || storedUser.name || "");
      setEmail((prev) => prev || storedUser.email || "");
      const countryFromStorage = String(storedUser.countryOfResidence || "").trim();
      if (countryFromStorage) {
        setBillingCountry((prev) => prev || countryFromStorage);
      }
      setReferralUserCode((prev) => prev || buildReferralCode(storedUser as unknown as Record<string, unknown>));
      setHasPrefilledUser(true);
    } catch {
      // Ignore malformed localStorage payload.
    }
  }, [isAuthenticated, hasPrefilledUser, countryCode]);

  React.useEffect(() => {
    if (appliedPromo?.billing && appliedPromo.billing !== billing) {
      setAppliedPromo(null);
      setPromoMessage("");
      setPromoError(`${appliedPromo.code} was removed because billing changed.`);
    }
  }, [billing, appliedPromo]);

  const handleApplyPromo = () => {
    const normalized = promo.trim().toUpperCase();
    if (!normalized) {
      setPromoError("Please enter a promo code.");
      setPromoMessage("");
      setAppliedPromo(null);
      return;
    }

    const found = PROMO_CODES.find((item) => item.code === normalized);
    if (!found) {
      setPromoError("Invalid promo code.");
      setPromoMessage("");
      setAppliedPromo(null);
      return;
    }

    if (found.billing && found.billing !== billing) {
      setPromoError(`${found.code} is valid only for ${found.billing} billing.`);
      setPromoMessage("");
      setAppliedPromo(null);
      return;
    }
    setAppliedPromo(found);
    setPromoError("");
    setPromoMessage(`${found.code} applied: ${found.discountPercent}% off.`);
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");
    setSessionMessage("");

    if (!email.trim() || !fullName.trim() || !phone.trim()) {
      setCheckoutError("Please fill Email, Full Name, and Phone to continue.");
      return;
    }

    if (!billingCountry.trim()) {
      setCheckoutError("Please enter billing country.");
      return;
    }

    if (!selectedCountryCode.trim()) {
      setCheckoutError("Please select country code.");
      return;
    }

    if (!isValidCountryCode(selectedCountryCode)) {
      setCheckoutError("Invalid country code selected.");
      return;
    }

    if (isIndiaBilling && !billingState.trim()) {
      setCheckoutError("Please enter billing state for India billing.");
      return;
    }

    if (selectedCountryCode.trim() === "+91" && gstNumber.trim() && !/^\d/.test(gstNumber.trim())) {
      setCheckoutError("For India (+91), GST number should start with digits.");
      return;
    }

    if (!isIndiaBilling && displayCurrency.code === "INR") {
      setCheckoutError("For non-India billing country, currency cannot be INR.");
      return;
    }

    if (promo.trim() && !appliedPromo) {
      setCheckoutError("Please apply a valid promo code before continuing.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onRequireLogin();
      return;
    }

    setIsProcessingPayment(true);
    setPaymentStatus("idle");

    try {
      const { data } = await axios.post(
        buildApiUrl("/api/subscription/create-subscription"),
        {
          plan,
          billing,
          promoCode: appliedPromo?.code || null,
          billingCountry: billingCountry.trim(),
          billingState: billingState.trim(),
          countryCode: selectedCountryCode.trim(),
          organization: company.trim(),
          gstVatNumber: gstNumber.trim(),
          referralUserCode: referralUserCode.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const serverPayable = Number((Number(data?.amount || 0) / 100).toFixed(2));
      const clientPayable = Number(finalTotal.toFixed(2));
      if (!Number.isFinite(serverPayable) || serverPayable < 0) {
        setCheckoutError("Invalid payment amount from server. Please try again.");
        return;
      }
      if (Math.abs(serverPayable - clientPayable) > 0.01) {
        setCheckoutError(
          `Amount mismatch detected. Expected ${formatInr(clientPayable)}, server payable is ${formatInr(
            serverPayable
          )}. Please re-apply promo and try again.`
        );
        return;
      }
      if ((appliedPromo?.code || null) !== (data?.promoCode || null)) {
        setCheckoutError("Promo code mismatch detected. Please apply promo again and retry.");
        return;
      }

      if (serverPayable <= 0) {
        setCheckoutError("Invalid payment amount from server. Please try again.");
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setCheckoutError("Unable to load payment SDK. Please try again.");
        return;
      }

      const verifyPaymentWithRetry = async (payload: any, retries = 2) => {
        let lastError: any = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            await axios.post(
              buildApiUrl("/api/subscription/verify-subscription"),
              payload,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            return;
          } catch (error: any) {
            lastError = error;
            if (error?.response?.status === 401) {
              clearStoredAuth();
              setSessionMessage("Your session expired. Please sign in again.");
              onRequireLogin();
              throw error;
            }
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
            }
          }
        }
        throw lastError;
      };

      const options = {
        key: data.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY,
        order_id: data.id,
        name: "NRITAX.AI",
        description: `${selectedPlan.label} (${billing})${appliedPromo ? ` - ${appliedPromo.code}` : ""}`,
        prefill: {
          name: fullName,
          email,
          contact: phone,
        },
        handler: async (response: any) => {
          try {
            await verifyPaymentWithRetry({ ...response, plan, billing });
            setPaymentStatus("success");
            setCheckoutError("");
            sessionStorage.setItem("subscription_popup", "Payment successful. Your plan has been activated.");
            setTimeout(() => {
              navigate("/home");
            }, 500);
          } catch (verifyError: any) {
            console.error(verifyError.response?.data || verifyError);
            setPaymentStatus("failed");
            setCheckoutError(
              verifyError.response?.data?.message || "Payment verification failed."
            );
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus("failed");
            setCheckoutError("Payment was cancelled before completion.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (failure: any) => {
        const reason =
          failure?.error?.description ||
          failure?.error?.reason ||
          "Payment failed. Please try again.";
        setPaymentStatus("failed");
        setCheckoutError(reason);
      });
      rzp.open();
    } catch (error: any) {
      console.error(error.response?.data || error);
      setPaymentStatus("failed");
      if (error?.response?.status === 401) {
        clearStoredAuth();
        setSessionMessage("Your session expired. Please sign in again.");
        onRequireLogin();
        setCheckoutError("Your session expired. Please sign in again.");
        return;
      }
      setCheckoutError(error.response?.data?.message || "Unable to start payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-16 px-6 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl bg-[#F7FAFC] border border-[#E2E8F0] shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 size-14 rounded-full bg-[#2563eb]/12 border border-[#2563eb]/40 flex items-center justify-center">
            <Lock className="size-7 text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#0F172A] mb-2">Login Required</h1>
          <p className="text-[#0F172A] mb-6">
            Please login to continue with secure subscription checkout.
          </p>
          <Button onClick={onRequireLogin} className="w-full h-11 text-base">
            Login / Sign Up
          </Button>
        </div>
      </div>
    );
  }

  if (isIosNativeApp) {
    return (
      <div className="py-16 px-6 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-2xl bg-[#F7FAFC] border border-[#E2E8F0] shadow-xl p-8">
          <h1 className="text-2xl font-semibold text-[#0F172A] mb-2">Checkout unavailable on iOS</h1>
          <p className="text-[#0F172A] mb-3">
            This iOS app does not support direct purchase checkout.
          </p>
          <p className="text-[#0F172A] mb-6">
            If you already subscribed on the website, log in to access all paid features here.
          </p>
          <Button onClick={() => navigate("/pricing")} className="w-full h-11 text-base">
            Back to Pricing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <Badge className="bg-[#2563eb]/12 text-[#0F172A] border-[#2563eb]/40 mb-4">Secure Checkout</Badge>
          <h1 className="text-3xl sm:text-4xl text-[#0F172A] tracking-tight mb-3">Complete Your Subscription</h1>
          <p className="text-[#0F172A] max-w-2xl mx-auto">
            Confirm your plan, enter billing details, and continue to payment or free promo redemption.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6 lg:gap-8 items-start">
          <aside className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] shadow-lg p-6 sm:p-7 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 rounded-lg bg-[#3b82f6] border border-[#E2E8F0] flex items-center justify-center">
                <ReceiptText className="size-5 text-[#0F172A]" />
              </div>
              <div>
                <p className="text-sm text-[#0F172A]">Order Summary</p>
                <h2 className="text-lg font-semibold text-[#0F172A]">{selectedPlan.label}</h2>
              </div>
              {selectedPlan.badge && (
                <Badge className="ml-auto bg-[#2563eb] text-[#0F172A]">{selectedPlan.badge}</Badge>
              )}
            </div>


            <div className="inline-flex bg-[#3b82f6] p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  billing === "monthly" ? "bg-[#F7FAFC] text-[#0F172A] shadow" : "text-[#0F172A]"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  billing === "yearly" ? "bg-[#F7FAFC] text-[#0F172A] shadow" : "text-[#0F172A]"
                }`}
              >
                Yearly
              </button>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm text-[#0F172A]">Display Currency</p>
              <Select value={currencyOverride} onValueChange={handleCurrencyOverrideChange}>
                <SelectTrigger className="bg-[#F7FAFC] border-[#E2E8F0]">
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

            <div className="space-y-3 border-y border-[#E2E8F0] py-5">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span>{billing === "monthly" ? "Monthly Subscription" : "Yearly Subscription"}</span>
                <span className="text-[#0F172A] font-medium">{formatDisplayAmount(price)}</span>
              </div>
              {appliedPromo && (
                <div className="flex items-center justify-between text-[#2563eb]">
                  <span>Discount ({appliedPromo.code})</span>
                  <span>- {formatDisplayAmount(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="text-[#2563eb]">{formatDisplayAmount(finalTotal)}</span>
              </div>
              {displayCurrency.code !== "INR" && (
                <p className="text-xs text-[#0F172A] text-right">Charged in INR: {formatInr(finalTotal)}</p>
              )}
            </div>

            <div className="mt-5 space-y-2 text-sm text-[#0F172A]">
              <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#2563eb]" /> Instant plan activation after payment</p>
              <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#2563eb]" /> Encrypted and secure checkout flow</p>
              <p className="flex items-center gap-2"><CreditCard className="size-4 text-[#2563eb]" /> Powered by Razorpay</p>
              <p className="text-xs">
                {displayCurrencyHeadline} {billingCurrencyHeadline} Forex charges may apply.
              </p>
            </div>
          </aside>

          <section className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] shadow-lg p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-lg bg-[#2563eb]/12 border border-[#2563eb]/40 flex items-center justify-center">
                <Sparkles className="size-5 text-[#2563eb]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Billing Information</h2>
                <p className="text-sm text-[#0F172A]">You can edit pre-filled details before payment.</p>
              </div>
            </div>

            {sessionMessage ? (
              <p className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {sessionMessage}
              </p>
            ) : null}

            <form className="space-y-5" onSubmit={handleProceedToPayment}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Phone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(stripLeadingCountryCode(e.target.value, selectedCountryCode))
                    }
                    placeholder="Enter phone number"
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Organization (optional)</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your company name"
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Country Code *</label>
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="bg-[#F7FAFC] border-[#E2E8F0] h-11">
                      <SelectValue placeholder="Select country code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        {autoCountryCode ? `Auto (${autoCountryCode})` : "Auto (based on Billing Country)"}
                      </SelectItem>
                      {COUNTRY_CODE_OPTIONS.map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    Billing State {isIndiaBilling ? "*" : "(optional)"}
                  </label>
                  <input
                    type="text"
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    placeholder={isIndiaBilling ? "Karnataka" : "State/Province"}
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Billing Country *</label>
                  <input
                    type="text"
                    value={billingCountry}
                    onChange={(e) => setBillingCountry(e.target.value)}
                    placeholder="India"
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                </div>
                <div />
              </div>

              {isIndiaBilling && (
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">GST or VAT Number (optional)</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                  <p className="mt-1 text-xs text-[#0F172A]">Shown for India billing.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Referral User Code</label>
                <input
                  type="text"
                  value={referralUserCode}
                  onChange={(e) => setReferralUserCode(e.target.value.toUpperCase())}
                  placeholder="Auto-generated referral code"
                  className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                />
                <p className="mt-1 text-xs text-[#0F172A]">
                  This code is unique per user and tied to active subscription context.
                </p>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC] p-4">
                <label className="block text-sm font-medium text-[#0F172A] mb-2">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    placeholder="ENTER PROMO CODE"
                    className="flex-1 h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]/400 outline-none"
                  />
                  <Button type="button" onClick={handleApplyPromo} className="h-11 px-5">
                    Apply
                  </Button>
                </div>

                {promoMessage && <p className="text-sm text-[#2563eb] mt-2">{promoMessage}</p>}
                {promoError && <p className="text-sm text-red-600 mt-2">{promoError}</p>}

                <div className="mt-3 text-xs text-[#0F172A] space-y-1">
                  <p className="font-medium text-[#0F172A]">Available promo codes</p>
                  <p>SANDBOX10, SANDBOX20, SANDBOXY25, SANDBOX15</p>
                </div>
              </div>

              {checkoutError && (
                <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 p-3">
                  {checkoutError}
                </p>
              )}

              {paymentStatus === "success" && (
                <p className="text-sm text-[#2563eb] rounded-lg bg-[#2563eb]/12 border border-[#2563eb]/40 p-3">
                  Payment successful. Your plan has been activated.
                </p>
              )}

              <Button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full h-12 text-base"
              >
                {isProcessingPayment
                  ? "Starting Payment..."
                  : `Pay ${formatDisplayAmount(finalTotal)} Securely`}
              </Button>

              <p className="text-xs text-center text-[#0F172A]">
                You will be redirected to secure Razorpay checkout in INR.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;














