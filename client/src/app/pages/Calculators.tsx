import { useState } from 'react'
import { Calculator, DollarSign, FileText, Info, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { COUNTRY_LIST, getTaxData, calculateTax, getTaxSlabDescription, formatCurrency, type CountryCode } from '../data/taxRegulations'
import { renderTextWithShortForms } from '../utils/shortForms'

type CalculatorType = 'residency' | 'income' | 'dtaa' | null

const stripNonNumeric = (value: string) => value.replace(/,/g, '').replace(/[^\d.]/g, '')
const addThousandSeparators = (value: string, locale: string = 'en-US') => {
  if (!value) return ''
  const [integerPart, decimalPart] = value.split('.')
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0'
  const formattedInteger = new Intl.NumberFormat(locale).format(Number(normalizedInteger))
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
}

interface CalculatorsProps {
  onRequireLogin: () => void
}

export function Calculators(_props: CalculatorsProps) {
  const [activeCalc, setActiveCalc] = useState<CalculatorType>(null)

  return (
    <div className="min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-4">Tax Calculators</h1>
        <p className="text-gray-600 text-lg">
          {renderTextWithShortForms('Free tools to help you understand your NRI tax obligations')}
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
        }}
        className="grid md:grid-cols-3 gap-6 mb-8"
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24, scale: 0.98 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        <button
          onClick={() => setActiveCalc('residency')}
          className={`p-6 rounded-lg border-2 transition-all text-left ${
            activeCalc === 'residency'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Tax Residency Status</h3>
          <p className="text-gray-600 text-sm">
            Determine your residency status in India and Indonesia
          </p>
        </button>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24, scale: 0.98 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        <button
          onClick={() => setActiveCalc('income')}
          className={`p-6 rounded-lg border-2 transition-all text-left ${
            activeCalc === 'income'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Income Tax Calculator</h3>
          <p className="text-gray-600 text-sm">
            Calculate your India or Indonesia income tax liability
          </p>
        </button>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24, scale: 0.98 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        <button
          onClick={() => setActiveCalc('dtaa')}
          className={`p-6 rounded-lg border-2 transition-all text-left ${
            activeCalc === 'dtaa'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">DTAA Tax Credit</h3>
          <p className="text-gray-600 text-sm">
            {renderTextWithShortForms('Calculate tax credit available under DTAA')}
          </p>
        </button>
        </motion.div>
      </motion.div>

      <motion.div
        key={activeCalc ?? 'none'}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {activeCalc === 'residency' && <ResidencyCalculator />}
        {activeCalc === 'income' && <IncomeTaxCalculator />}
        {activeCalc === 'dtaa' && <DTAACalculator />}
      </motion.div>

      {!activeCalc && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a Calculator</h3>
          <p className="text-gray-500">
            Choose one of the calculators above to get started with your tax calculations
          </p>
        </div>
      )}

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>Disclaimer:</strong> These are estimates for educational purposes only.
            Consult a tax professional for accurate filing and personalized advice.
          </p>
        </div>
      </div>
    </div>
  )
}

function ResidencyCalculator() {
  const [daysInIndia, setDaysInIndia] = useState('')
  const [daysInIndonesia, setDaysInIndonesia] = useState('')
  const [isIndianCitizen, setIsIndianCitizen] = useState<boolean | null>(null)
  const [hasIndianIncome, setHasIndianIncome] = useState<boolean | null>(null)
  const [result, setResult] = useState<any>(null)

  const handleCalculate = () => {
    const indiaDays = parseInt(daysInIndia) || 0
    const indonesiaDays = parseInt(daysInIndonesia) || 0

    let indiaStatus = 'Non-Resident'
    let indiaExplanation = 'You spend less than 182 days in India.'

    if (indiaDays >= 182) {
      indiaStatus = 'Resident'
      indiaExplanation = 'You spend 182 or more days in India during the financial year.'
    } else if (indiaDays >= 60 && isIndianCitizen) {
      indiaStatus = 'RNOR'
      indiaExplanation = 'You are Resident but Not Ordinarily Resident - an Indian citizen spending 60-181 days in India.'
    } else if (indiaDays >= 120 && hasIndianIncome) {
      indiaStatus = 'RNOR'
      indiaExplanation = 'You spend 120-181 days in India with Indian income, qualifying as RNOR.'
    }

    let indonesiaStatus = 'Non-Resident'
    let indonesiaExplanation = 'You spend less than 183 days in Indonesia.'

    if (indonesiaDays >= 183) {
      indonesiaStatus = 'Resident'
      indonesiaExplanation = 'You spend 183 or more days in Indonesia during the calendar year.'
    }

    setResult({
      indiaStatus,
      indiaExplanation,
      indonesiaStatus,
      indonesiaExplanation
    })
  }

  const handleReset = () => {
    setDaysInIndia('')
    setDaysInIndonesia('')
    setIsIndianCitizen(null)
    setHasIndianIncome(null)
    setResult(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold">Tax Residency Status Calculator</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Days in India (Current Financial Year)
          </label>
          <input
            type="number"
            value={daysInIndia}
            onChange={(e) => setDaysInIndia(e.target.value)}
            placeholder="150"
            min="0"
            max="365"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Financial Year: April 1 - March 31</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Days in Indonesia (Current Calendar Year)
          </label>
          <input
            type="number"
            value={daysInIndonesia}
            onChange={(e) => setDaysInIndonesia(e.target.value)}
            placeholder="200"
            min="0"
            max="365"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Calendar Year: January 1 - December 31</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Are you an Indian citizen?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="citizen"
                checked={isIndianCitizen === true}
                onChange={() => setIsIndianCitizen(true)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="citizen"
                checked={isIndianCitizen === false}
                onChange={() => setIsIndianCitizen(false)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Do you have Indian income?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="income"
                checked={hasIndianIncome === true}
                onChange={() => setHasIndianIncome(true)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="income"
                checked={hasIndianIncome === false}
                onChange={() => setHasIndianIncome(false)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">No</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCalculate}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Calculate
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>

        {result && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 space-y-4">
            <div>
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                India Tax Residency Status
              </h3>
              <p className="text-lg font-bold text-blue-700 mb-1">{result.indiaStatus}</p>
              <p className="text-sm text-blue-600">{result.indiaExplanation}</p>
              {result.indiaStatus === 'RNOR' && (
                <p className="text-xs text-blue-500 mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{renderTextWithShortForms('RNOR: Resident but Not Ordinarily Resident - special status with limited tax scope')}</span>
                </p>
              )}
            </div>

            <div className="border-t border-blue-200 pt-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Indonesia Tax Residency Status
              </h3>
              <p className="text-lg font-bold text-blue-700 mb-1">{result.indonesiaStatus}</p>
              <p className="text-sm text-blue-600">{result.indonesiaExplanation}</p>
            </div>

            <div className="bg-white border border-blue-200 rounded p-4 mt-4">
              <p className="text-sm text-gray-700">
                <strong>What this means:</strong> Your residency status determines which country
                has the primary right to tax your income. If you're a resident in both countries,
                {renderTextWithShortForms('the DTAA (Double Taxation Avoidance Agreement) provides tiebreaker rules.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IncomeTaxCalculator() {
  const [income, setIncome] = useState('')
  const [country, setCountry] = useState<CountryCode>('ID')
  const [incomeType, setIncomeType] = useState('Salary')
  const [result, setResult] = useState<any>(null)

  const handleCalculate = () => {
    const amount = parseFloat(stripNonNumeric(income)) || 0
    const tax = calculateTax(amount, country)
    const taxRate = amount > 0 ? (tax / amount) * 100 : 0
    const slab = getTaxSlabDescription(amount, country)
    const takeHome = amount - tax

    setResult({
      tax,
      taxRate,
      slab,
      takeHome,
      country
    })
  }

  const handleReset = () => {
    setIncome('')
    setCountry('ID')
    setIncomeType('Salary')
    setResult(null)
  }

  const currentCountryData = getTaxData(country)

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Calculator className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold">Income Tax Calculator</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COUNTRY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Income ({currentCountryData.currency})
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={income}
            onChange={(e) =>
              setIncome(
                addThousandSeparators(
                  stripNonNumeric(e.target.value),
                  currentCountryData.currency === 'INR' ? 'en-IN' : 'en-US'
                )
              )
            }
            placeholder={currentCountryData.currency === 'INR' ? '10,00,000' : '1,000,000'}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Tax Year: {currentCountryData.taxYear}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Income Type
          </label>
          <select
            value={incomeType}
            onChange={(e) => setIncomeType(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Salary">Salary</option>
            <option value="Business">Business</option>
            <option value="Rental">Rental</option>
            <option value="Capital Gains">Capital Gains</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">This calculator uses standard {incomeType.toLowerCase()} income tax rates</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCalculate}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Calculate
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>

        {result && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 space-y-4">
            <div>
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Tax Calculation Results
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Estimated Tax:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(result.tax, result.country)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Tax Slab:</span>
                  <span className="font-semibold text-blue-900">{result.slab}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Effective Tax Rate:</span>
                  <span className="font-semibold text-blue-900">{result.taxRate.toFixed(2)}%</span>
                </div>

                <div className="border-t border-blue-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Take-Home Income:</span>
                    <span className="text-xl font-bold text-blue-900">
                      {formatCurrency(result.takeHome, result.country)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-blue-200 rounded p-4 mt-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Note:</strong> This is a simplified calculation based on standard tax slabs.
                Actual tax may vary based on deductions, exemptions, and other factors.
              </p>
              {currentCountryData.specialNotes && currentCountryData.specialNotes.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside mt-2">
                  {currentCountryData.specialNotes.slice(0, 2).map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DTAACalculator() {
  const [indiaIncome, setIndiaIncome] = useState('')
  const [indiaTaxPaid, setIndiaTaxPaid] = useState('')
  const [residency, setResidency] = useState<CountryCode>('ID')
  const [foreignTaxRate, setForeignTaxRate] = useState('')
  const [result, setResult] = useState<any>(null)

  const handleCalculate = () => {
    const income = parseFloat(stripNonNumeric(indiaIncome)) || 0
    const taxPaid = parseFloat(stripNonNumeric(indiaTaxPaid)) || 0
    const foreignRate = parseFloat(foreignTaxRate) || 0

    const foreignTaxOnIndianIncome = income * (foreignRate / 100)
    const taxCreditAvailable = Math.min(taxPaid, foreignTaxOnIndianIncome)
    const netTaxPayable = Math.max(0, foreignTaxOnIndianIncome - taxCreditAvailable)
    const totalTaxBurden = taxPaid + netTaxPayable
    const effectiveRate = income > 0 ? (totalTaxBurden / income) * 100 : 0

    setResult({
      taxCreditAvailable,
      netTaxPayable,
      totalTaxBurden,
      effectiveRate,
      foreignTaxOnIndianIncome,
      country: residency
    })
  }

  const handleReset = () => {
    setIndiaIncome('')
    setIndiaTaxPaid('')
    setResidency('ID')
    setForeignTaxRate('')
    setResult(null)
  }

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const currentCountryData = getTaxData(residency)

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-lg">
          <DollarSign className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold">{renderTextWithShortForms('DTAA Tax Credit Calculator')}</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="mb-2">
              <strong>{renderTextWithShortForms('DTAA')}:</strong> Double Taxation Avoidance Agreement helps you avoid paying tax twice on the same income.
            </p>
            <p className="text-xs">
              <strong>{renderTextWithShortForms(`${currentCountryData.name} DTAA`)}:</strong> {renderTextWithShortForms(currentCountryData.dtaaDetails)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Income earned in India (INR)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={indiaIncome}
            onChange={(e) => setIndiaIncome(addThousandSeparators(stripNonNumeric(e.target.value), 'en-IN'))}
            placeholder="10,00,000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tax paid in India (INR)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={indiaTaxPaid}
            onChange={(e) => setIndiaTaxPaid(addThousandSeparators(stripNonNumeric(e.target.value), 'en-IN'))}
            placeholder="1,00,000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Total income tax paid or deducted in India</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your tax residency country
          </label>
          <select
            value={residency}
            onChange={(e) => setResidency(e.target.value as CountryCode)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COUNTRY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">The country where you are a tax resident</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {currentCountryData.name} tax rate (%)
          </label>
          <input
            type="number"
            value={foreignTaxRate}
            onChange={(e) => setForeignTaxRate(e.target.value)}
            placeholder="25"
            min="0"
            max="100"
            step="0.1"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your applicable tax rate in {currentCountryData.name} (typically {currentCountryData.taxSlabs[0].rate * 100}-{currentCountryData.taxSlabs[currentCountryData.taxSlabs.length - 1].rate * 100}%)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCalculate}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Calculate
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>

        {result && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 space-y-4">
            <div>
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {renderTextWithShortForms('DTAA Tax Credit Analysis')}
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">{getTaxData(result.country).name} tax on Indian income:</span>
                  <span className="font-semibold text-blue-900">
                    {formatINR(result.foreignTaxOnIndianIncome)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">{renderTextWithShortForms('Tax credit available under DTAA:')}</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatINR(result.taxCreditAvailable)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Net tax payable in {getTaxData(result.country).name}:</span>
                  <span className="font-semibold text-blue-900">
                    {formatINR(result.netTaxPayable)}
                  </span>
                </div>

                <div className="border-t border-blue-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Total effective tax rate:</span>
                    <span className="text-xl font-bold text-blue-900">
                      {result.effectiveRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-blue-200 rounded p-4 mt-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>{renderTextWithShortForms('How DTAA works')}:</strong>
              </p>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>You can claim credit for tax already paid in India</li>
                <li>Credit is limited to the lower of: tax paid in India or tax due in Indonesia</li>
                <li>This prevents you from paying tax twice on the same income</li>
                <li>{renderTextWithShortForms("You'll need Form 67 to claim this credit in your ITR")}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

