import { useEffect, useMemo, useState } from "react";
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
import {
  CONSULTATION_TIME_ZONES,
  formatConsultationTimeLabel,
  getBrowserTimeZone,
  getAvailableConsultationTimeSlots,
  normalizeConsultationDate,
  normalizeConsultationTime,
  normalizeConsultationTimeZone,
  trimValue,
  isValidEmail,
} from "../utils/consultationWorkflow";
import { buildApiUrl } from "../../utils/api";
import { COUNTRY_OPTIONS, detectUserCountry } from "../utils/countries";

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
  timeZone: "",
  preferredDate: "",
  preferredTime: "",
};

const isSunday = (date: Date) => date.getDay() === 0;
type FormFieldKey =
  | "name"
  | "email"
  | "phone"
  | "country"
  | "timeZone"
  | "preferredDate"
  | "preferredTime"
  | "service"
  | "queryDetails";

export function CPAContact({ onClose, embedded = false }: CPAContactProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormFieldKey, string>>>({});
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
  const availableTimeSlots = useMemo(
    () => getAvailableConsultationTimeSlots(formData.preferredDate, formData.timeZone),
    [formData.preferredDate, formData.timeZone]
  );
  const selectedPreferredTimeLabel = formData.preferredTime
    ? formatConsultationTimeLabel(formData.preferredTime)
    : "";
  const timeSlotPanelHeight = useMemo(() => {
    const visibleRows = Math.min(Math.max(availableTimeSlots.length, 1), 5);
    return visibleRows * 40 + 16;
  }, [availableTimeSlots]);
  const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);
  const timeZoneOptions = useMemo(() => {
    const normalizedBrowserTimeZone = normalizeConsultationTimeZone(browserTimeZone);
    if (
      normalizedBrowserTimeZone &&
      !CONSULTATION_TIME_ZONES.includes(normalizedBrowserTimeZone as (typeof CONSULTATION_TIME_ZONES)[number])
    ) {
      return [normalizedBrowserTimeZone, ...CONSULTATION_TIME_ZONES];
    }

    return [...CONSULTATION_TIME_ZONES];
  }, [browserTimeZone]);

  const whatsappDigits = CONTACT_WHATSAPP.replace(/\D/g, "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser = localStorage.getItem("user");
    if (!rawUser) {
      setFormData((prev) => (prev.country ? prev : { ...prev, country: detectUserCountry() }));
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser);
      setFormData((prev) => ({
        ...prev,
        name: prev.name || trimValue(parsedUser?.name),
        email: prev.email || trimValue(parsedUser?.email),
        country: prev.country || trimValue(parsedUser?.countryOfResidence) || detectUserCountry(),
      }));
    } catch {
      setFormData((prev) => (prev.country ? prev : { ...prev, country: detectUserCountry() }));
    }
  }, []);

  const setFieldValue = (key: keyof typeof INITIAL_FORM_DATA, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as FormFieldKey];
        return next;
      });
    }
    if (errorMessage) setErrorMessage("");
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<FormFieldKey, string>> = {};
    const country = formData.country === "other" ? trimValue(formData.customCountry) : trimValue(formData.country);
    const timeZone = normalizeConsultationTimeZone(formData.timeZone);
    const preferredDate = normalizeConsultationDate(formData.preferredDate);
    const preferredTime = normalizeConsultationTime(formData.preferredTime);

    if (!trimValue(formData.name)) nextErrors.name = "Full name is required.";
    if (!isValidEmail(formData.email)) nextErrors.email = "Enter a valid email address.";
    if (!trimValue(formData.phone)) nextErrors.phone = "Phone number is required.";
    if (!country) nextErrors.country = "Country is required.";
    if (!timeZone) nextErrors.timeZone = "Timezone is required.";
    if (!preferredDate) nextErrors.preferredDate = "Consultation date is required.";
    if (!preferredTime) nextErrors.preferredTime = "Time slot is required.";
    if (!trimValue(formData.service)) nextErrors.service = "Service selection is required.";
    if (!trimValue(formData.queryDetails)) nextErrors.queryDetails = "Please describe your tax situation and concerns.";

    if (preferredDate && selectedDate) {
      if (selectedDate < today) nextErrors.preferredDate = "Please choose a date from today onwards.";
      if (selectedDate.getDay() === 0) nextErrors.preferredDate = "Bookings are not available on Sundays.";
    }

    if (
      preferredTime &&
      !availableTimeSlots.includes(preferredTime as (typeof availableTimeSlots)[number])
    ) {
      nextErrors.preferredTime =
        availableTimeSlots.length > 0
          ? "Choose one of the remaining available slots."
          : "No slots are left for today. Please choose another date.";
    }

    if (formData.contactMethod === "whatsapp" && !trimValue(formData.whatsapp)) {
      setErrorMessage("Please provide your WhatsApp number for WhatsApp contact preference.");
    }

    setFieldErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, country, timeZone, preferredDate, preferredTime };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    const { isValid, country, timeZone, preferredDate, preferredTime } = validateForm();
    if (!isValid || (formData.contactMethod === "whatsapp" && !trimValue(formData.whatsapp))) {
      setLoading(false);
      return;
    }

    const payload = {
      name: trimValue(formData.name),
      email: trimValue(formData.email),
      phone: trimValue(formData.phone),
      whatsapp: trimValue(formData.whatsapp),
      contactMethod: trimValue(formData.contactMethod),
      country,
      preferredDate,
      preferredTime,
      timeZone,
      service: trimValue(formData.service),
      queryDetails: trimValue(formData.queryDetails),
    };

    try {
      const response = await fetch(buildApiUrl("/api/consultations"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(result?.message || "Failed to submit consultation request.");
      }
      const message = trimValue(result?.message) || "Consultation request submitted successfully.";

      setSuccessMessage(message);
      setFormData(INITIAL_FORM_DATA);
      setFieldErrors({});
      setSubmitted(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to submit consultation request.");
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
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex h-full min-h-[110px] flex-col justify-between rounded-lg border border-[#E2E8F0] p-4 text-sm hover:bg-[#F7FAFC]">
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><Mail className="size-4" /> Email</p>
              <p className="text-[#0F172A] mt-1 truncate">{CONTACT_EMAIL}</p>
            </a>
            <a href={`https://wa.me/${whatsappDigits}`} className="flex h-full min-h-[110px] flex-col justify-between rounded-lg border border-[#E2E8F0] p-4 text-sm hover:bg-[#F7FAFC]">
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><MessageSquare className="size-4" /> WhatsApp</p>
              <p className="text-[#0F172A] mt-1 truncate">{CONTACT_WHATSAPP}</p>
            </a>
            <a href={CONTACT_CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="flex h-full min-h-[110px] flex-col justify-between rounded-lg border border-[#E2E8F0] p-4 text-sm hover:bg-[#F7FAFC]">
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
                  onChange={(e) => setFieldValue("name", e.target.value)}
                  placeholder="Your full name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
                {fieldErrors.name ? <p id="name-error" className="text-sm text-red-600">{fieldErrors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFieldValue("email", e.target.value)}
                  placeholder="your.email@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                {fieldErrors.email ? <p id="email-error" className="text-sm text-red-600">{fieldErrors.email}</p> : null}
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
                  onChange={(e) => setFieldValue("phone", e.target.value)}
                  placeholder="+1 234 567 8900"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                />
                {fieldErrors.phone ? <p id="phone-error" className="text-sm text-red-600">{fieldErrors.phone}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number (optional)</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) => setFieldValue("whatsapp", e.target.value)}
                  placeholder="+62 812 3456 7890"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeZone">Preferred Timezone *</Label>
                <Select
                  value={formData.timeZone}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      timeZone: value,
                      preferredDate: "",
                      preferredTime: "",
                    }));
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.timeZone;
                      delete next.preferredDate;
                      delete next.preferredTime;
                      return next;
                    });
                    setDatePickerMessage("");
                    setErrorMessage("");
                    setIsDatePickerOpen(false);
                    setIsTimePickerOpen(false);
                  }}
                >
                  <SelectTrigger id="timeZone" aria-invalid={Boolean(fieldErrors.timeZone)}>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeZoneOptions.map((timeZone) => (
                      <SelectItem key={timeZone} value={timeZone}>
                        {timeZone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!fieldErrors.timeZone ? (
                  <p className="text-sm text-slate-500">
                    {browserTimeZone
                      ? `Browser detected: ${browserTimeZone}. Select your timezone to continue.`
                      : "Pick your timezone first to see the matching consultation slots."}
                  </p>
                ) : null}
                {fieldErrors.timeZone ? <p className="text-sm text-red-600">{fieldErrors.timeZone}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactMethod">Preferred Contact Method *</Label>
                <Select value={formData.contactMethod} onValueChange={(value) => setFieldValue("contactMethod", value)}>
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
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      country: value,
                      customCountry: "",
                    }));
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.country;
                      return next;
                    });
                    if (errorMessage) setErrorMessage("");
                  }}
                >
                  <SelectTrigger aria-invalid={Boolean(fieldErrors.country)}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((country) => (
                      <SelectItem key={country.code} value={country.name}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!fieldErrors.country ? (
                  <p className="text-sm text-slate-500">
                    {formData.country
                      ? `Using ${formData.country} as your country of residence.`
                      : "We try to auto-detect your country first, and you can adjust it here."}
                  </p>
                ) : null}
                {fieldErrors.country ? <p className="text-sm text-red-600">{fieldErrors.country}</p> : null}
              </div>
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <div className="relative self-start space-y-2">
                <Label htmlFor="preferredDate">Preferred Date *</Label>
                <Button
                  id="preferredDate"
                  type="button"
                  variant="outline"
                  disabled={!formData.timeZone}
                  onClick={() => {
                    if (!formData.timeZone) return;
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
                  <div className="absolute left-0 top-full z-30 rounded-md border bg-white p-2 shadow-lg">
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
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.preferredDate;
                          return next;
                        });
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
                {!formData.timeZone ? <p className="text-xs text-slate-500">Select a timezone before choosing a date.</p> : null}
                {datePickerMessage && <p className="text-xs text-slate-500">{datePickerMessage}</p>}
                {fieldErrors.preferredDate ? <p className="text-sm text-red-600">{fieldErrors.preferredDate}</p> : null}
              </div>
            <div className="relative self-start space-y-2">
              <Label htmlFor="preferredTime">Preferred Time *</Label>
              <Button
                id="preferredTime"
                type="button"
                variant="outline"
                disabled={!formData.timeZone || !formData.preferredDate}
                onClick={() => {
                  if (!formData.timeZone || !formData.preferredDate) return;
                  setIsTimePickerOpen((prev) => !prev);
                  setIsDatePickerOpen(false);
                }}
                className={cn(
                  "h-11 w-full justify-between px-3 text-left font-normal",
                  !formData.preferredTime && "text-slate-500",
                )}
                aria-invalid={Boolean(fieldErrors.preferredTime)}
              >
                <span>{selectedPreferredTimeLabel || "Select a time slot"}</span>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-slate-500" />
                  <ChevronDown className="size-4 text-slate-500" />
                </div>
              </Button>
              {isTimePickerOpen && formData.preferredDate && (
                <div className="absolute left-0 top-full z-30 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                  <ScrollArea className="w-full" style={{ height: `${timeSlotPanelHeight}px` }}>
                    <div className="grid gap-1 p-2">
                      {availableTimeSlots.map((slot) => (
                        <Button
                          key={slot}
                          type="button"
                          variant={formData.preferredTime === slot ? "default" : "ghost"}
                          className="justify-start rounded-sm"
                          onClick={() => {
                            setFormData({ ...formData, preferredTime: slot });
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.preferredTime;
                              return next;
                            });
                            setErrorMessage("");
                            setIsTimePickerOpen(false);
                          }}
                        >
                          {formatConsultationTimeLabel(slot)}
                        </Button>
                      ))}
                      {availableTimeSlots.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-slate-500">No slots are available for the rest of today.</p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <p className="text-xs text-slate-500">
                {formData.timeZone
                  ? `Times shown in ${formData.timeZone}.`
                  : "Select a timezone to view time slots."}{" "}
                Consultation hours are converted from 09:00 AM to 06:00 PM IST, and past slots for today are automatically hidden.
              </p>
              {fieldErrors.preferredTime ? <p className="text-sm text-red-600">{fieldErrors.preferredTime}</p> : null}
            </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service Required *</Label>
              <Select value={formData.service} onValueChange={(value) => setFieldValue("service", value)}>
                <SelectTrigger aria-invalid={Boolean(fieldErrors.service)}>
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
              {fieldErrors.service ? <p className="text-sm text-red-600">{fieldErrors.service}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxQuery">Tax Query Details *</Label>
              <Textarea
                id="taxQuery"
                required
                value={formData.queryDetails}
                onChange={(e) => setFieldValue("queryDetails", e.target.value)}
                placeholder="Please describe your tax situation and specific concerns..."
                rows={4}
                aria-invalid={Boolean(fieldErrors.queryDetails)}
                aria-describedby={fieldErrors.queryDetails ? "query-error" : undefined}
              />
              {fieldErrors.queryDetails ? <p id="query-error" className="text-sm text-red-600">{fieldErrors.queryDetails}</p> : null}
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
