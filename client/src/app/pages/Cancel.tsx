import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  buildCancelPayload,
  CONSULTATION_WEBHOOKS,
  getConsultationIdentifierFromSearchParams,
  postConsultationWebhook,
} from "../utils/consultationWorkflow";

export function Cancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identifier = useMemo(() => getConsultationIdentifierFromSearchParams(searchParams), [searchParams]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleCancel = async () => {
    if (!identifier || loading) return;
    if (identifier.key !== "token") {
      setErrorMessage("This cancellation link is missing a valid token.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = buildCancelPayload(identifier);
      const result = await postConsultationWebhook<{ message?: string }>(CONSULTATION_WEBHOOKS.cancel, payload);
      setSubmitted(true);
      setSuccessMessage(result?.message || "Your consultation has been cancelled successfully.");
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to cancel the consultation right now.");
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
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <CardTitle className="text-3xl text-[#0F172A]">Cancel Consultation</CardTitle>
                <CardDescription className="mt-1 text-base text-[#475569]">
                  Confirm cancellation of your NRITAX CPA consultation booking.
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
                    <p className="text-lg font-semibold">Consultation cancelled</p>
                  </div>
                  <p>{successMessage}</p>
                </div>
                <Button type="button" onClick={() => navigate("/consult")} className="w-full sm:w-auto">
                  Book Another Consultation
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#475569]">
                  {identifier && identifier.key === "token" ? (
                    <span>
                      Cancellation request detected using <strong>token</strong>: {identifier.value}
                    </span>
                  ) : (
                    <span>Please use a valid cancellation link containing a token.</span>
                  )}
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
                    <p>
                      This action will send a live cancellation request to the consultation workflow. Please confirm only
                      if you want to cancel this booking.
                    </p>
                  </div>
                </div>

                {errorMessage ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)} className="sm:flex-1">
                    Keep Booking
                  </Button>
                  <Button
                    type="button"
                    disabled={loading || !identifier || identifier.key !== "token"}
                    onClick={handleCancel}
                    className="bg-red-600 text-white hover:bg-red-700 sm:flex-1"
                  >
                    {loading ? "Cancelling..." : "Confirm Cancellation"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
