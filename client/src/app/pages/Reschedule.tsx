import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  AVAILABLE_CONSULTATION_TIME_SLOTS,
  buildReschedulePayload,
  CONSULTATION_WEBHOOKS,
  getConsultationIdentifierFromSearchParams,
  normalizeConsultationDate,
  normalizeConsultationTime,
  postConsultationWebhook,
} from "../utils/consultationWorkflow";

type FieldErrors = {
  date?: string;
  time?: string;
};

export function Reschedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identifier = useMemo(() => getConsultationIdentifierFromSearchParams(searchParams), [searchParams]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const validate = () => {
    const nextErrors: FieldErrors = {};
    const normalizedDate = normalizeConsultationDate(date);
    const normalizedTime = normalizeConsultationTime(time);

    if (!normalizedDate) nextErrors.date = "Please choose a new consultation date.";
    if (!normalizedTime) nextErrors.time = "Please choose a new time slot.";

    setFieldErrors(nextErrors);
    return {
      valid: Boolean(identifier) && Object.keys(nextErrors).length === 0,
      normalizedDate,
      normalizedTime,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setErrorMessage("");
    setSuccessMessage("");

    const { valid, normalizedDate, normalizedTime } = validate();
    if (!identifier) {
      setErrorMessage("This reschedule link is missing a valid token, booking reference, or email.");
      return;
    }
    if (!valid) return;

    setLoading(true);
    try {
      const payload = buildReschedulePayload(identifier, normalizedDate, normalizedTime);
      const result = await postConsultationWebhook<{ message?: string }>(CONSULTATION_WEBHOOKS.reschedule, payload);
      setSubmitted(true);
      setSuccessMessage(result?.message || "Your consultation has been rescheduled successfully.");
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to reschedule your consultation right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-[#2563eb] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <Card className="rounded-3xl border-[#E2E8F0] bg-white shadow-sm">
          <CardHeader className="border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#2563eb]/10 p-3 text-[#2563eb]">
                <CalendarDays className="size-6" />
              </div>
              <div>
                <CardTitle className="text-3xl text-[#0F172A]">Reschedule Consultation</CardTitle>
                <CardDescription className="mt-1 text-base text-[#475569]">
                  Choose a new date and time for your NRITAX CPA consultation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {submitted ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
                  <div className="mb-3 flex items-center gap-3">
                    <CheckCircle2 className="size-6" />
                    <p className="text-lg font-semibold">Consultation rescheduled</p>
                  </div>
                  <p>{successMessage}</p>
                </div>
                <Button type="button" onClick={() => navigate("/consult")} className="w-full sm:w-auto">
                  Return to Consultation Page
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#475569]">
                  {identifier ? (
                    <span>
                      Reschedule request detected using <strong>{identifier.key}</strong>: {identifier.value}
                    </span>
                  ) : (
                    <span>Please use a valid reschedule link containing a token, booking reference, or email.</span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reschedule-date">New Date</Label>
                    <Input
                      id="reschedule-date"
                      type="date"
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, date: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.date)}
                    />
                    {fieldErrors.date ? <p className="text-sm text-red-600">{fieldErrors.date}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reschedule-time">New Time Slot</Label>
                    <Select
                      value={time}
                      onValueChange={(value) => {
                        setTime(value);
                        setFieldErrors((prev) => ({ ...prev, time: undefined }));
                      }}
                    >
                      <SelectTrigger id="reschedule-time" aria-invalid={Boolean(fieldErrors.time)}>
                        <SelectValue placeholder="Select a time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_CONSULTATION_TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.time ? <p className="text-sm text-red-600">{fieldErrors.time}</p> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-sm text-[#1D4ED8]">
                  <div className="flex items-center gap-2 font-medium">
                    <Clock3 className="size-4" />
                    Updated bookings are submitted instantly to the live consultation workflow.
                  </div>
                </div>

                {errorMessage ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)} className="sm:flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !identifier} className="sm:flex-1">
                    {loading ? "Submitting..." : "Reschedule Consultation"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

