import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { LegalDocumentViewer } from "../components/LegalDocumentViewer";
import { Button } from "../components/ui/button";

type PrivacyLocationState = {
  fromHero?: boolean;
  fromSite?: boolean;
  returnTo?: string;
};

export function PrivacyPolicy() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as PrivacyLocationState;
  const isFromHero = state.fromHero === true;
  const isFromSite = state.fromSite === true || !isFromHero;
  const returnTo = useMemo(() => {
    const nextPath = state.returnTo || "/";
    return nextPath.startsWith("/") ? nextPath : "/";
  }, [state.returnTo]);

  const handlePolicyAcknowledged = () => {
    navigate(returnTo, { replace: true, state: { privacyReviewed: true } });
  };

  return (
    <LegalDocumentViewer
      title="Privacy Policy"
      subtitle="Official NRITaxAI privacy policy document"
      pdfPath="/legal/nritaxai-privacy-policy.pdf"
      summary="The uploaded privacy policy PDF is shown below and is also available to open in a new tab or download."
      footer={
        isFromHero ? (
          <>
            <p className="text-sm text-[#0F172A]">
              After reviewing this policy, confirm below to return and enable the acknowledgment checkbox on the hero page.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => navigate(returnTo, { replace: true })}>
                Back
              </Button>
              <Button type="button" onClick={handlePolicyAcknowledged}>
                I Have Read the Privacy Policy
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[#0F172A]">
              {isFromSite
                ? "You are viewing the standard site privacy policy page from the website footer."
                : "You are viewing the official privacy policy document."}
            </p>
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
            </div>
          </>
        )
      }
    />
  );
}
