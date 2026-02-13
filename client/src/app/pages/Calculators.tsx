import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calculator, TrendingDown, Home, Coins } from "lucide-react";

export function Calculators() {
  const [taxCalc, setTaxCalc] = useState({
    income: "",
    country: "usa",
    incomeType: "salary"
  });

  const [capitalGains, setCapitalGains] = useState({
    purchasePrice: "",
    salePrice: "",
    period: "long-term"
  });

  const [rentalIncome, setRentalIncome] = useState({
    monthlyRent: "",
    expenses: ""
  });

  const calculateIncomeTax = () => {
    const income = parseFloat(taxCalc.income) || 0;
    let tax = 0;

    // Basic Indian tax slabs for NRI
    if (income <= 250000) tax = 0;
    else if (income <= 500000) tax = (income - 250000) * 0.05;
    else if (income <= 1000000) tax = 12500 + (income - 500000) * 0.2;
    else tax = 112500 + (income - 1000000) * 0.3;

    return tax.toFixed(2);
  };

  const calculateCapitalGains = () => {
    const purchase = parseFloat(capitalGains.purchasePrice) || 0;
    const sale = parseFloat(capitalGains.salePrice) || 0;
    const gain = sale - purchase;

    if (gain <= 0) return "0.00";

    const rate = capitalGains.period === "long-term" ? 0.125 : 0.20;
    const tax = gain * rate;

    return tax.toFixed(2);
  };

  const calculateRentalTax = () => {
    const rent = (parseFloat(rentalIncome.monthlyRent) || 0) * 12;
    const expenses = parseFloat(rentalIncome.expenses) || 0;
    const netIncome = rent - expenses;

    if (netIncome <= 0) return "0.00";

    const tax = netIncome * 0.3; // 30% for NRIs
    return tax.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Calculator className="size-8 text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl mb-4">Tax Calculators</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Estimate your tax liability with our NRI-specific calculators
          </p>
        </div>

        <Tabs defaultValue="income" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="income">Income Tax</TabsTrigger>
            <TabsTrigger value="capital-gains">Capital Gains</TabsTrigger>
            <TabsTrigger value="rental">Rental Income</TabsTrigger>
          </TabsList>

          {/* Income Tax Calculator */}
          <TabsContent value="income">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Coins className="size-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Income Tax Calculator</CardTitle>
                    <CardDescription>Calculate your NRI income tax liability</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="income">Annual Income (₹)</Label>
                  <Input
                    id="income"
                    type="number"
                    placeholder="1000000"
                    value={taxCalc.income}
                    onChange={(e) => setTaxCalc({ ...taxCalc, income: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country of Residence</Label>
                  <Select value={taxCalc.country} onValueChange={(value) => setTaxCalc({ ...taxCalc, country: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usa">United States</SelectItem>
                      <SelectItem value="uae">United Arab Emirates</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="singapore">Singapore</SelectItem>
                      <SelectItem value="canada">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="income-type">Income Type</Label>
                  <Select value={taxCalc.incomeType} onValueChange={(value) => setTaxCalc({ ...taxCalc, incomeType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="business">Business Income</SelectItem>
                      <SelectItem value="other">Other Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Estimated Tax Liability</p>
                      <p className="text-3xl mt-1">₹{calculateIncomeTax()}</p>
                    </div>
                    <TrendingDown className="size-12 text-blue-600" />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  * This is an estimate based on standard tax slabs. Actual tax may vary based on deductions and DTAA provisions.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Capital Gains Calculator */}
          <TabsContent value="capital-gains">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingDown className="size-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Capital Gains Tax Calculator</CardTitle>
                    <CardDescription>Calculate tax on sale of property or investments</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="purchase">Purchase Price (₹)</Label>
                  <Input
                    id="purchase"
                    type="number"
                    placeholder="5000000"
                    value={capitalGains.purchasePrice}
                    onChange={(e) => setCapitalGains({ ...capitalGains, purchasePrice: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale">Sale Price (₹)</Label>
                  <Input
                    id="sale"
                    type="number"
                    placeholder="7000000"
                    value={capitalGains.salePrice}
                    onChange={(e) => setCapitalGains({ ...capitalGains, salePrice: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period">Holding Period</Label>
                  <Select value={capitalGains.period} onValueChange={(value) => setCapitalGains({ ...capitalGains, period: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long-term">Long-term (&gt;24 months) - 12.5%</SelectItem>
                      <SelectItem value="short-term">Short-term (&lt;24 months) - 20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Capital Gains</p>
                      <p className="text-2xl mt-1">
                        ₹{((parseFloat(capitalGains.salePrice) || 0) - (parseFloat(capitalGains.purchasePrice) || 0)).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">Estimated Tax</p>
                      <p className="text-3xl mt-1">₹{calculateCapitalGains()}</p>
                    </div>
                    <TrendingDown className="size-12 text-green-600" />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  * Tax rates as per latest regulations. Indexation benefits may apply for long-term gains.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rental Income Calculator */}
          <TabsContent value="rental">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Home className="size-6 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Rental Income Tax Calculator</CardTitle>
                    <CardDescription>Calculate tax on rental income from property in India</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="rent">Monthly Rental Income (₹)</Label>
                  <Input
                    id="rent"
                    type="number"
                    placeholder="50000"
                    value={rentalIncome.monthlyRent}
                    onChange={(e) => setRentalIncome({ ...rentalIncome, monthlyRent: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenses">Annual Expenses & Deductions (₹)</Label>
                  <Input
                    id="expenses"
                    type="number"
                    placeholder="100000"
                    value={rentalIncome.expenses}
                    onChange={(e) => setRentalIncome({ ...rentalIncome, expenses: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Includes municipal taxes, repairs, standard deduction (30% of rent)
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Annual Rental Income</p>
                      <p className="text-2xl mt-1">
                        ₹{((parseFloat(rentalIncome.monthlyRent) || 0) * 12).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">Estimated Tax (30% for NRI)</p>
                      <p className="text-3xl mt-1">₹{calculateRentalTax()}</p>
                    </div>
                    <Home className="size-12 text-orange-600" />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  * NRIs are taxed at 30% (plus surcharge and cess) on rental income. DTAA benefits may apply.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Additional Info */}
        <Card className="max-w-4xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Need Personalized Tax Planning?</CardTitle>
            <CardDescription>
              These calculators provide estimates. For accurate tax planning and filing assistance, consult with our certified CPAs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button>Book CPA Consultation</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
