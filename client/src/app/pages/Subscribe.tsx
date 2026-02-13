import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, CreditCard, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Subscribe() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    name: "",
    email: ""
  });
  const [subscribed, setSubscribed] = useState(false);

  const plans = {
    pro: {
      name: "Pro",
      price: 29,
      features: ["Unlimited AI chat", "1 CPA consultation/month", "All calculators"]
    },
    enterprise: {
      name: "Enterprise",
      price: 99,
      features: ["Everything in Pro", "Unlimited CPA consultations", "Dedicated advisor"]
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
  };

  if (subscribed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16 px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
              <CheckCircle2 className="size-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Subscription Successful!</CardTitle>
            <CardDescription>
              Welcome to NRITAX.AI {plans[selectedPlan as keyof typeof plans].name} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Your subscription is now active. Check your email for confirmation and next steps.
              </p>
            </div>
            <Button onClick={() => navigate('/chat')} className="w-full">
              Start Using AI Chat
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl mb-4">Complete Your Subscription</h1>
          <p className="text-xl text-gray-600">
            Start your 7-day free trial today
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Plan Selection */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl mb-4">Select Plan</h2>
            
            <Card
              className={`cursor-pointer transition-all ${
                selectedPlan === "pro" ? 'border-blue-600 border-2' : ''
              }`}
              onClick={() => setSelectedPlan("pro")}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Pro
                  <Badge>Popular</Badge>
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl text-gray-900">${plans.pro.price}</span>/month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plans.pro.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${
                selectedPlan === "enterprise" ? 'border-blue-600 border-2' : ''
              }`}
              onClick={() => setSelectedPlan("enterprise")}
            >
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>
                  <span className="text-3xl text-gray-900">${plans.enterprise.price}</span>/month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plans.enterprise.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCard className="size-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Payment Information</CardTitle>
                    <CardDescription>Enter your payment details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="your.email@example.com"
                      value={paymentInfo.email}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="card-name">Cardholder Name</Label>
                    <Input
                      id="card-name"
                      required
                      placeholder="John Doe"
                      value={paymentInfo.name}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input
                      id="card-number"
                      required
                      placeholder="1234 5678 9012 3456"
                      value={paymentInfo.cardNumber}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, cardNumber: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input
                        id="expiry"
                        required
                        placeholder="MM/YY"
                        value={paymentInfo.expiry}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, expiry: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        required
                        placeholder="123"
                        value={paymentInfo.cvv}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cvv: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">
                        {plans[selectedPlan as keyof typeof plans].name} Plan
                      </span>
                      <span className="text-sm">
                        ${plans[selectedPlan as keyof typeof plans].price}/month
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600">7-day free trial</span>
                      <span className="text-sm text-green-600">-$0.00</span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="">Due Today</span>
                      <span className="text-2xl">$0.00</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Lock className="size-4" />
                    <span>Secured by 256-bit SSL encryption</span>
                  </div>

                  <Button type="submit" className="w-full" size="lg">
                    Start Free Trial
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    You won't be charged during your 7-day free trial. Cancel anytime.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
