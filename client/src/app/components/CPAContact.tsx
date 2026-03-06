import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, CheckCircle2, Mail, MessageSquare, UserCheck, X } from "lucide-react";
import { submitConsultationRequest } from "../../utils/api";
import { CONTACT_CALENDLY_URL, CONTACT_EMAIL, CONTACT_WHATSAPP } from "../../config/appConfig";

interface CPAContactProps {
  onClose: () => void;
  embedded?: boolean;
}

export function CPAContact({ onClose, embedded = false }: CPAContactProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    preferredContact: "email",
    country: "",
    customCountry: "",
    taxQuery: "",
    service: "",
    preferredDate: "",
    preferredTime: "",
  });

  const whatsappDigits = CONTACT_WHATSAPP.replace(/\D/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const country = formData.country === "other" ? formData.customCountry.trim() : formData.country;
    if (!country) {
      setError("Please select your country of residence.");
      return;
    }

    if (formData.preferredContact === "whatsapp" && !formData.whatsappNumber.trim()) {
      setError("Please provide your WhatsApp number for WhatsApp contact preference.");
      return;
    }

    setSubmitting(true);
    try {
      await submitConsultationRequest({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        country,
        service: formData.service.trim(),
        taxQuery: formData.taxQuery.trim(),
        preferredContact: formData.preferredContact,
        whatsappNumber: formData.whatsappNumber.trim(),
        date: formData.preferredDate,
        time: formData.preferredTime,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit consultation request. Please try again.");
    } finally {
      setSubmitting(false);
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
                Our certified CPA will contact you within 24 hours. We have also emailed your confirmation.
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
                <CardTitle>Consult a Certified CPA</CardTitle>
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
              <p className="font-medium text-[#0F172A] flex items-center gap-2"><Calendar className="size-4" /> Schedule Call</p>
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
                <Label htmlFor="whatsappNumber">WhatsApp Number (optional)</Label>
                <Input
                  id="whatsappNumber"
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  placeholder="+62 812 3456 7890"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredContact">Preferred Contact Method *</Label>
                <Select value={formData.preferredContact} onValueChange={(value) => setFormData({ ...formData, preferredContact: value })}>
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
              <div className="space-y-2">
                <Label htmlFor="preferredDate">Preferred Date (optional)</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredTime">Preferred Time (optional)</Label>
                <Input
                  id="preferredTime"
                  type="time"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                />
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
                  <SelectItem value="dtaa">DTAA Consultation</SelectItem>
                  <SelectItem value="itr-filing">ITR Filing Assistance</SelectItem>
                  <SelectItem value="compliance">Compliance Review</SelectItem>
                  <SelectItem value="nro-nre">NRO/NRE Account Guidance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxQuery">Tax Query Details *</Label>
              <Textarea
                id="taxQuery"
                required
                value={formData.taxQuery}
                onChange={(e) => setFormData({ ...formData, taxQuery: e.target.value })}
                placeholder="Please describe your tax situation and specific concerns..."
                rows={4}
              />
            </div>

            <div className="bg-[#2563eb]/12 border border-[#2563eb]/40 rounded-lg p-4 text-sm">
              <p className="text-[#2563eb]">
                <strong>Note:</strong> All consultations are confidential and comply with ICAI standards.
                Our CPAs are registered professionals with expertise in NRI taxation and DTAA regulations.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {embedded ? "Back" : "Cancel"}
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
