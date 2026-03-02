import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";

export function PrivacyPolicy() {
  const navigate = useNavigate();

  const handleReadAndBack = () => {
    window.localStorage.setItem("privacyPolicyRead", "true");
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50 to-white">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Please read this privacy policy before accepting and entering the website.
          </p>

          <div className="mt-6 space-y-6 text-sm leading-6 text-slate-700">
            <section>
              <h2 className="font-semibold text-slate-900">1. Information We Collect</h2>
              <p className="mt-2">We may collect the following types of information:</p>
              <p className="mt-2 font-medium text-slate-900">A. Personal Information</p>
              <p>When you register or use our services, we may collect:</p>
              <ul className="list-disc pl-6">
                <li>Name</li>
                <li>Email address</li>
                <li>Account credentials</li>
                <li>Payment-related information</li>
              </ul>
              <p className="mt-2 font-medium text-slate-900">B. Usage Information</p>
              <p>We may automatically collect:</p>
              <ul className="list-disc pl-6">
                <li>IP address</li>
                <li>Browser type</li>
                <li>Device information</li>
                <li>Pages visited</li>
                <li>Interaction data</li>
              </ul>
              <p className="mt-2 font-medium text-slate-900">C. Tax and Query Information</p>
              <p>When you use our AI assistant, we may process:</p>
              <ul className="list-disc pl-6">
                <li>Tax-related questions</li>
                <li>Financial information voluntarily provided by you</li>
              </ul>
              <p className="mt-2">
                We do not intentionally collect sensitive personal data beyond what you provide.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">2. How We Use Your Information</h2>
              <p className="mt-2">We use your information to:</p>
              <ul className="list-disc pl-6">
                <li>Provide AI-based tax assistance</li>
                <li>Process payments and subscriptions</li>
                <li>Authenticate user accounts</li>
                <li>Improve our services and user experience</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">3. Payment Processing</h2>
              <p className="mt-2">
                Payments and subscriptions are securely processed through Razorpay.
              </p>
              <p>
                We do not store your full card details on our servers. Payment information is handled according to
                Razorpay&apos;s security standards.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">4. Google Authentication</h2>
              <p className="mt-2">If you log in using Google Sign-In, we may receive:</p>
              <ul className="list-disc pl-6">
                <li>Your name</li>
                <li>Your email address</li>
              </ul>
              <p>
                We use this information only for authentication and account creation purposes.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">5. Data Storage &amp; Security</h2>
              <p className="mt-2">
                We implement reasonable technical and organizational security measures to protect your data.
              </p>
              <p>
                However, no online system is 100% secure. While we strive to protect your information, we cannot
                guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">6. Data Retention</h2>
              <p className="mt-2">We retain your information:</p>
              <ul className="list-disc pl-6">
                <li>As long as your account is active</li>
                <li>As needed to comply with legal obligations</li>
                <li>Until you request deletion</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">7. Your Rights</h2>
              <p className="mt-2">You may:</p>
              <ul className="list-disc pl-6">
                <li>Request access to your data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account</li>
                <li>Withdraw consent where applicable</li>
              </ul>
              <p className="mt-2">To make a request, contact us at: support@nritax.ai</p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">8. Third-Party Services</h2>
              <p className="mt-2">We may use trusted third-party services, including:</p>
              <ul className="list-disc pl-6">
                <li>Razorpay (payments)</li>
                <li>Hosting providers</li>
                <li>Analytics services</li>
              </ul>
              <p>
                These providers may process your data in accordance with their own privacy policies.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">9. Children&apos;s Privacy</h2>
              <p className="mt-2">
                NRITAX is not intended for individuals under the age of 13. We do not knowingly collect personal
                information from children.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">10. Changes to This Policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. Changes will be posted on this page with an
                updated revision date.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900">11. Contact Us</h2>
              <p className="mt-2">If you have any questions about this Privacy Policy, please contact:</p>
              <p>Email: support@nritax.ai</p>
              <p>Website: https://nritax.ai</p>
            </section>
          </div>

          <div className="mt-8">
            <Button onClick={handleReadAndBack} className="bg-blue-600 text-white hover:bg-blue-700">
              I Have Read the Privacy Policy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
