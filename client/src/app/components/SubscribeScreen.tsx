import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Stars,
} from "lucide-react";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import {
  getProducts,
  getSubscriptionProductId,
  initPurchases,
  isNativePurchasePlatform,
  manageSubscriptions,
  purchaseSubscription,
  restorePurchases,
} from "../../services/subscription";

type ProductState = {
  id: string;
  title: string;
  description: string;
  price: string;
  offerToken?: string;
};

const featureList = [
  "AI Tax Assistant",
  "Filing Guidance",
  "DTAA Advice",
  "Expert Connect",
];

const fallbackProduct: ProductState = {
  id: getSubscriptionProductId(),
  title: "Yearly Premium Plan",
  description: "Continue to the App Store purchase sheet to confirm product details and subscribe.",
  price: "Available in App Store",
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

export default function SubscribeScreen() {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [productLoading, setProductLoading] = useState(true);
  const [product, setProduct] = useState<ProductState>(fallbackProduct);
  const [productAvailable, setProductAvailable] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("info");
  const [isSupportedPlatform] = useState(() => isNativePurchasePlatform());

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      if (!isSupportedPlatform) {
        setProductLoading(false);
        return;
      }

      try {
        await initPurchases();
        const products = await getProducts();
        const firstProduct = products[0];

        if (!isMounted) return;

        if (!firstProduct) {
          setStatusTone("info");
          setProductAvailable(false);
          setStatusMessage(
            "Product details are still loading. You can still open the App Store sheet and verify the final price there."
          );
          return;
        }

        setProductAvailable(true);
        setProduct({
          id: firstProduct.id,
          title: firstProduct.displayName || fallbackProduct.title,
          description: firstProduct.description || fallbackProduct.description,
          price: firstProduct.displayPrice || fallbackProduct.price,
          offerToken: firstProduct.basePlans?.[0]?.offerToken,
        });
      } catch (error) {
        if (!isMounted) return;
        setProductAvailable(false);
        setStatusTone("info");
        setStatusMessage("Product details are still loading. You can still open the App Store sheet and verify the final price there.");
      } finally {
        if (isMounted) {
          setProductLoading(false);
        }
      }
    };

    void setup();

    return () => {
      isMounted = false;
    };
  }, [isSupportedPlatform]);

  const handleSubscribe = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      await purchaseSubscription(product.offerToken);
      setStatusTone("success");
      setStatusMessage("Subscription flow opened successfully. Complete the App Store prompts to finish your purchase.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setStatusMessage(null);

    try {
      const result = await restorePurchases();
      const hasSubscription = Array.isArray(result?.subscriptions) && result.subscriptions.length > 0;
      setStatusTone(hasSubscription ? "success" : "info");
      setStatusMessage(
        hasSubscription
          ? "Active subscription restored for this App Store account."
          : "No active App Store subscriptions were found to restore."
      );
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(getErrorMessage(error));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-8"
      style={{ minHeight: "calc(var(--app-viewport-height) - 8rem)" }}
    >
      <section className="overflow-hidden rounded-[2rem] border border-[#BFDBFE] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_35%,#eff6ff_100%)] px-6 py-10 text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur">
              <Stars className="size-4" />
              Premium Access
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">NriTaxAI Premium</h1>
            <p className="mt-4 text-base text-blue-50 sm:text-lg">
              Subscribe from the iOS app to unlock guided filing support, faster expert access, and deeper cross-border tax workflows.
            </p>
          </div>
          <div className="grid gap-3 rounded-[1.5rem] border border-white/20 bg-white/10 p-5 backdrop-blur md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Current Plan</p>
              <p className="mt-2 text-2xl font-bold">{productLoading ? "Loading..." : product.price}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Purchase Flow</p>
              <p className="mt-2 text-sm text-blue-50">Secure App Store checkout with Apple-managed billing and renewals.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[#BFDBFE] bg-white shadow-[0_20px_60px_rgba(37,99,235,0.08)]">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F172A]">{product.title}</CardTitle>
            <CardDescription className="text-base text-[#475569]">{product.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#1D4ED8]">Current Price</p>
              <p className="mt-2 text-4xl font-bold text-[#0F172A]">{productLoading ? "Loading..." : product.price}</p>
              <p className="mt-2 text-sm text-[#475569]">Final price and billing confirmation always appear in the App Store purchase sheet.</p>
            </div>

            <ul className="grid gap-3">
              {featureList.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-[#0F172A]">
                  <CheckCircle2 className="size-5 text-[#16A34A]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {!isSupportedPlatform ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Native App Store purchases are only available in the Capacitor iOS or Android app.
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] p-4 text-sm text-[#334155]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2563EB]" />
                <div>
                  <p className="font-semibold text-[#0F172A]">The purchase button stays enabled on iOS</p>
                  <p className="mt-1">
                    Even if metadata loads slowly, you can still continue into the App Store sheet and verify the final subscription there.
                  </p>
                </div>
              </div>
            </div>

            {statusMessage ? (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  statusTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : statusTone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {statusTone === "error" ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:flex-1"
              onClick={() => void handleSubscribe()}
              disabled={loading || !isSupportedPlatform}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Subscribe Now"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void manageSubscriptions()}
              disabled={!isSupportedPlatform}
            >
              Manage Plan
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-[#E2E8F0] bg-white/90">
          <CardHeader>
            <CardTitle className="text-xl text-[#0F172A]">Already subscribed?</CardTitle>
            <CardDescription className="text-sm text-[#64748B]">
              Restore access for the App Store account on this device and refresh the app’s subscription state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-sm text-[#334155]">
              Use restore if you purchased previously and the app is not showing premium access yet.
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleRestore()}
              disabled={restoring || !isSupportedPlatform}
            >
              <RefreshCcw className="size-4" />
              {restoring ? "Restoring..." : "Restore Purchases"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
