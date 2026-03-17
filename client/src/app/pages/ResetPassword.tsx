import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resetPassword } from "../../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const [formData, setFormData] = useState({ newPassword: "", confirmNewPassword: "" });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage("This password reset link is invalid or missing.");
      return;
    }

    if (!formData.newPassword || !formData.confirmNewPassword) {
      setErrorMessage("Please enter and confirm your new password.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({
        token,
        newPassword: formData.newPassword,
        confirmNewPassword: formData.confirmNewPassword,
      });
      setSuccessMessage(response?.message || "Password reset successful. Please sign in.");
      setFormData({ newPassword: "", confirmNewPassword: "" });
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || "Unable to reset password right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Choose a new password for your NRITAX account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600">This password reset link is invalid or missing.</p>
              <p className="text-center text-sm text-slate-600">
                <Link to="/login" className="text-[#2563eb] hover:underline">
                  Back to Login
                </Link>
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(event) => setFormData((prev) => ({ ...prev, newPassword: event.target.value }))}
                placeholder="Enter a new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={formData.confirmNewPassword}
                onChange={(event) => setFormData((prev) => ({ ...prev, confirmNewPassword: event.target.value }))}
                placeholder="Re-enter your new password"
              />
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            {successMessage ? <p className="text-sm text-green-600">{successMessage}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <p className="text-center text-sm text-slate-600">
              <Link to="/login" className="text-[#2563eb] hover:underline">
                Back to Login
              </Link>
            </p>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
