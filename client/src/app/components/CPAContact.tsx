import { useMemo, useState } from "react";
import { format, isValid, parseISO, startOfToday } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "./ui/utils";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar as CalendarIcon, CheckCircle2, ChevronDown, Clock3, Mail, MessageSquare, UserCheck, X } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { ScrollArea } from "./ui/scroll-area";
import { CONTACT_CALENDLY_URL, CONTACT_EMAIL, CONTACT_WHATSAPP } from "../../config/appConfig";
import { renderTextWithShortForms } from "../utils/shortForms";

interface CPAContactProps {
  onClose: () => void;
  embedded?: boolean;
}

const INITIAL_FORM_DATA = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  contactMethod: "email",
  country: "",
  customCountry: "",
  queryDetails: "",
  service: "",
  preferredDate: "",
  preferredTime: "",
};

const WEBHOOK_URL = "https://n8n.caloganathan.com/webhook/consultation-booking";
const AVAILABLE_TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
] as const;
const isSunday = (date: Date) => date.getDay() === 0;

export function CPAContact({ onClose, embedded = false }: CPAContactProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [datePickerMessage, setDatePickerMessage] = useState("");

  const today = useMemo(() => startOfToday(), []);
  const selectedDate = useMemo(() => {
    if (!formData.preferredDate) return undefined;
    const parsed = parseISO(formData.preferredDate);
    return isValid(parsed) ? parsed : undefined;
  }, [formData.preferredDate]);
  const formattedPreferredDate = selectedDate ? format(selectedDate, "PP") : "";

  const whatsappDigits = CONTACT_WHATSAPP.replace(/\D/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const country = formData.country === "other" ? formData.customCountry.trim() : formData.country;
    if (!country) {
      setErrorMessage("Please select your country of residence.");
      setLoading(false);
      return;
    }

    if (!formData.service.trim()) {
      setErrorMessage("Please select the service required.");
      setLoading(false);
      return;
    }

    if (!formData.queryDetails.trim()) {
      setErrorMessage("Please enter your tax query details.");
      setLoading(false);
      return;
    }

    if (formData.contactMethod === "whatsapp" && !formData.whatsapp.trim()) {
      setErrorMessage("Please provide your WhatsApp number for WhatsApp contact preference.");
      setLoading(false);
      return;
    }

    if (formData.preferredDate) {
      if (!selectedDate) {
        setErrorMessage("Please select a valid booking date.");
        setLoading(false);
        return;
      }

      if (selectedDate < today) {
        setErrorMessage("Please choose a date from today onwards.");
        setLoading(false);
        return;
      }

      if (selectedDate.getDay() === 0) {
        setErrorMessage("Bookings are not available on Sundays. Please choose another day.");
        setLoading(false);
        return;
      }
    }

    if (formData.preferredTime && !AVAILABLE_TIME_SLOTS.includes(formData.preferredTime as typeof AVAILABLE_TIME_SLOTS[number])) {
        setErrorMessage("Please choose a time between 09:00 and 18:00.");
        setLoading(false);
        return;
    }

    const payload = {
      name: formData.name.trim() || "",
      email: formData.email.trim() || "",
      phone: formData.phone.trim() || "",
      whatsapp: formData.whatsapp.trim() || "",
      contactMethod: formData.contactMethod || "",
      country: country || "",
      preferredDate: formData.preferredDate || "",
      preferredTime: formData.preferredTime || "",
      service: formData.service.trim() || "",
      queryDetails: formData.queryDetails.trim() || "",
      source: "Website Consultation Form",
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let result: { message?: string } | null = null;

      if (rawText && rawText.trim() !== "") {
        try {
          result = JSON.parse(rawText);
        } catch (parseError) {
          console.error("Invalid webhook response:", rawText, parseError);
          throw new Error("Server returned an invalid response");
        }
      }

      if (!response.ok) {
        throw new Error(
          result?.message || `Webhook request failed with status ${response.status}`
        );
      }

      const message = result?.message || "Consultation request submitted successfully";

      setSuccessMessage(message);
      setFormData(INITIAL_FORM_DATA);
      setSubmitted(true);
    } catch (error: any) {
      console.error("Consultation submit error:", error);
      setErrorMessage(
        error?.message === "Failed to fetch"
          ? "Network or CORS error while submitting the consultation request"
          : error?.message || "Failed to submit consultation request"
      );
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = embedded
    ? "w-full"
    : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto";

  if (submitted) {
    return (
      <div className={wrapperClass}>
        <Card className="w-full max-w-md">
          <CardHeader>
            {!embedded && (
              <div className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="size-5" />
                </Button>
              </div>
            )}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <CheckCircle2 className="size-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Request Submitted!</CardTitle>
              <CardDescription className="mt-2">
                {successMessage || "Our certified CPA will contact you within 24 hours. We have also emailed your confirmation."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={onClose} className="w-full">
              {embedded ? "Back" : "Close"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Card className="w-full max-w-2xl my-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2563eb]/12 rounded-lg">
                <UserCheck className="size-6 text-[#2563eb]" />
              </div>
              <div>
                <CardTitle>{renderTextWithShortForms("Consult a Certified CPA")}</CardTitle>
                <CardDescription>Expert tax planning and compliance support</CardDescription>
              </div>
            </div>
            {!embedded && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="size-5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-lg border border-[#E2E8F0] p-3 text-sm hover:bg-[#F7FAFC]">
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><Mail className="size-4" /> Email</p>
              <p className="text-[#0F172A] mt-1 truncate">{CONTACT_EMAIL}</p>
            </a>
            <a href={`https://wa.me/${whatsappDigits}`} className="rounded-lg border border-[#E2E8F0] p-3 text-sm hover:bg-[#F7FAFC]">
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><MessageSquare className="size-4" /> WhatsApp</p>
              <p className="text-[#0F172A] mt-1 truncate">{CONTACT_WHATSAPP}</p>
            </a>
            <a href={CONTACT_CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#E2E8F0] p-3 text-sm hover:bg-[#F7FAFC]">
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><CalendarIcon className="size-4" /> Schedule Call</p>
              <p className="text-[#0F172A] mt-1">Open calendar</p>
            </a>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number (optional)</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="+62 812 3456 7890"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactMethod">Preferred Contact Method *</Label>
                <Select value={formData.contactMethod} onValueChange={(value) => setFormData({ ...formData, contactMethod: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country of Residence *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      country: value,
                      customCountry: value === "other" ? prev.customCountry : "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usa">United States</SelectItem>
                    <SelectItem value="uae">United Arab Emirates</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="singapore">Singapore</SelectItem>
                    <SelectItem value="canada">Canada</SelectItem>
                    <SelectItem value="australia">Australia</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>

                {formData.country === "other" && (
                  <Input
                    id="customCountry"
                    required
                    value={formData.customCountry}
                    onChange={(e) => setFormData({ ...formData, customCountry: e.target.value })}
                    placeholder="Type your country"
                  />
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative space-y-2">
                <Label htmlFor="preferredDate">Preferred Date (optional)</Label>
                <Button
                  id="preferredDate"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDatePickerOpen((prev) => !prev);
                    setIsTimePickerOpen(false);
                  }}
                  className={cn(
                    "h-11 w-full justify-between px-3 text-left font-normal",
                    !formattedPreferredDate && "text-slate-500",
                  )}
                >
                  <span>{formattedPreferredDate || "Select a date"}</span>
                  <CalendarIcon className="size-4 text-slate-500" />
                </Button>
                {isDatePickerOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 rounded-md border bg-white p-2 shadow-lg">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      if (isSunday(date)) {
                        setDatePickerMessage("Sundays are unavailable; pick another day and then select a time between 09:00 and 18:00.");
                        return;
                      }

                      setFormData((prev) => ({
                        ...prev,
                        preferredDate: format(date, "yyyy-MM-dd"),
                        preferredTime: prev.preferredDate === format(date, "yyyy-MM-dd") ? prev.preferredTime : "",
                      }));
                      setDatePickerMessage("");
                      setErrorMessage("");
                      setIsDatePickerOpen(false);
                      setIsTimePickerOpen(false);
                    }}
                    onDayClick={(date, modifiers) => {
                      if (isSunday(date)) {
                        setDatePickerMessage("Sundays are unavailable; pick another day and then select a time between 09:00 and 18:00.");
                        return;
                      }

                      if (!modifiers.disabled) {
                        setDatePickerMessage("");
                      }
                    }}
                    disabled={[{ before: today }]}
                    modifiers={{ blockedSunday: isSunday }}
                    modifiersClassNames={{ blockedSunday: "text-muted-foreground opacity-50" }}
                    captionLayout="dropdown"
                  />
                  </div>
                )}
                {datePickerMessage && <p className="text-xs text-slate-500">{datePickerMessage}</p>}
              </div>
            <div className="relative space-y-2">
              <Label htmlFor="preferredTime">Preferred Time (optional)</Label>
              <Button
                id="preferredTime"
                type="button"
                variant="outline"
                disabled={!formData.preferredDate}
                onClick={() => {
                  if (!formData.preferredDate) return;
                  setIsTimePickerOpen((prev) => !prev);
                  setIsDatePickerOpen(false);
                }}
                className={cn(
                  "h-11 w-full justify-between px-3 text-left font-normal",
                  !formData.preferredTime && "text-slate-500",
                )}
              >
                <span>{formData.preferredTime || "Select a time slot"}</span>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-slate-500" />
                  <ChevronDown className="size-4 text-slate-500" />
                </div>
              </Button>
              {isTimePickerOpen && formData.preferredDate && (
                <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                  <ScrollArea className="h-64 w-full">
                    <div className="grid gap-1 p-2">
                      {AVAILABLE_TIME_SLOTS.map((slot) => (
                        <Button
                          key={slot}
                          type="button"
                          variant={formData.preferredTime === slot ? "default" : "ghost"}
                          className="justify-start rounded-sm"
                          onClick={() => {
                            setFormData({ ...formData, preferredTime: slot });
                            setErrorMessage("");
                            setIsTimePickerOpen(false);
                          }}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <p className="text-xs text-slate-500">Time slots are available only from 09:00 to 18:00.</p>
            </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service Required *</Label>
              <Select value={formData.service} onValueChange={(value) => setFormData({ ...formData, service: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax-planning">Tax Planning & Strategy</SelectItem>
                  <SelectItem value="dtaa">{renderTextWithShortForms("DTAA Consultation")}</SelectItem>
                  <SelectItem value="itr-filing">{renderTextWithShortForms("ITR Filing Assistance")}</SelectItem>
                  <SelectItem value="compliance">Compliance Review</SelectItem>
                  <SelectItem value="nro-nre">{renderTextWithShortForms("NRO/NRE Account Guidance")}</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxQuery">Tax Query Details *</Label>
              <Textarea
                id="taxQuery"
                required
                value={formData.queryDetails}
                onChange={(e) => setFormData({ ...formData, queryDetails: e.target.value })}
                placeholder="Please describe your tax situation and specific concerns..."
                rows={4}
              />
            </div>

            <div className="bg-[#2563eb]/12 border border-[#2563eb]/40 rounded-lg p-4 text-sm">
              <p className="text-[#2563eb]">
                <strong>Note:</strong> {renderTextWithShortForms("All consultations are confidential and comply with ICAI standards. Our CPAs are registered professionals with expertise in NRI taxation and DTAA regulations.")}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {embedded ? "Back" : "Cancel"}
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
            {successMessage && !submitted && (
              <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</p>
            )}
            {errorMessage && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
