import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Image as ImageIcon, Save, Pencil, Crown, CalendarDays, Sparkles, LockKeyhole, LogOut, Trash2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { changePassword, deleteAccount, getSubscriptionStatus, getUserProfile, updateUserProfile } from "../../utils/api";

type ProfileData = {
  name: string;
  email: string;
  profileImage?: string;
  phone?: string;
  countryOfResidence?: string;
  preferredLanguage?: "english" | "hindi" | "tamil" | "indonesian";
  bio?: string;
  provider?: "local" | "google";
  usage?: {
    queriesUsed?: number;
    lastReset?: string;
  };
  createdAt?: string;
};

type SubscriptionData = {
  plan: "FREE" | "PRO" | "PREMIUM";
  status: "active" | "inactive" | "cancelled" | "expired" | "trial";
  provider: "razorpay";
  subscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [phone, setPhone] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"english" | "hindi" | "tamil" | "indonesian">("english");
  const [bio, setBio] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      name.trim() !== profile.name.trim() ||
      (profileImage || "").trim() !== (profile.profileImage || "").trim() ||
      phone.trim() !== (profile.phone || "").trim() ||
      countryOfResidence.trim() !== (profile.countryOfResidence || "").trim() ||
      preferredLanguage !== (profile.preferredLanguage || "english") ||
      bio.trim() !== (profile.bio || "").trim()
    );
  }, [name, profileImage, phone, countryOfResidence, preferredLanguage, bio, profile]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    let active = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileResponse, subscriptionResponse] = await Promise.all([
          getUserProfile(),
          getSubscriptionStatus(),
        ]);
        if (!active) return;
        const data = profileResponse?.data;
        if (!data) {
          setError("Unable to load profile data.");
          return;
        }
        setProfile(data);
        setName(data.name || "");
        setProfileImage(data.profileImage || "");
        setPhone(data.phone || "");
        setCountryOfResidence(data.countryOfResidence || "");
        setPreferredLanguage(data.preferredLanguage || "english");
        setBio(data.bio || "");
        setSubscription(subscriptionResponse?.subscription || null);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.message || "Failed to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [navigate, token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (bio.trim().length > 240) {
      setError("Bio must be at most 240 characters.");
      return;
    }
    if (phone.trim() && !/^[\d+()\-\s]{7,20}$/.test(phone.trim())) {
      setError("Phone number format is invalid.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await updateUserProfile({
        name: name.trim(),
        profileImage: profileImage.trim(),
        phone: phone.trim(),
        countryOfResidence: countryOfResidence.trim(),
        preferredLanguage,
        bio: bio.trim(),
      });
      const updated = response?.data;
      if (!updated) {
        throw new Error("Invalid update response");
      }

      setProfile(updated);
      setName(updated.name || "");
      setProfileImage(updated.profileImage || "");
      setPhone(updated.phone || "");
      setCountryOfResidence(updated.countryOfResidence || "");
      setPreferredLanguage(updated.preferredLanguage || "english");
      setBio(updated.bio || "");
      setSuccessMessage("Profile updated successfully.");
      setIsEditingProfile(false);

      const storedUserRaw = localStorage.getItem("user");
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
      localStorage.setItem("user", JSON.stringify({ ...storedUser, ...updated }));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      setError("Please fill all password fields.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordForm);
      setSuccessMessage("Password changed successfully.");
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setError("");
    setSuccessMessage("");

    try {
      await deleteAccount();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_40%,#f8fafc_100%)] py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white/90">
          <CardContent className="p-6 sm:p-8">
            {loading ? (
              <p className="text-slate-600">Loading profile...</p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center">
                    {profileImage ? (
                      <img src={profileImage} alt={profile?.name || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <User className="size-8 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Welcome back</p>
                    <h1 className="text-2xl sm:text-3xl text-slate-900">{profile?.name}</h1>
                    <p className="text-slate-600">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    <Crown className="size-3 mr-1" />
                    {subscription?.plan || "FREE"} Plan
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {successMessage && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </p>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-slate-900">User Details</CardTitle>
                <CardDescription>Basic identity and account details</CardDescription>
              </div>
              {!isEditingProfile && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)}>
                  <Pencil className="size-4 mr-2" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingProfile ? (
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profileImage">Profile Image URL</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                      <Input
                        id="profileImage"
                        value={profileImage}
                        onChange={(e) => setProfileImage(e.target.value)}
                        className="pl-9"
                        placeholder="https://example.com/avatar.png"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="countryOfResidence">Country of Residence</Label>
                      <Input
                        id="countryOfResidence"
                        value={countryOfResidence}
                        onChange={(e) => setCountryOfResidence(e.target.value)}
                        placeholder="United States"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredLanguage">Preferred Language</Label>
                    <select
                      id="preferredLanguage"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as "english" | "hindi" | "tamil" | "indonesian")}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="english">English</option>
                      <option value="hindi">Hindi</option>
                      <option value="tamil">Tamil</option>
                      <option value="indonesian">Bahasa Indonesia</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={240}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      placeholder="Tell us a bit about your tax profile goals."
                    />
                    <p className="text-xs text-slate-500 text-right">{bio.length}/240</p>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setName(profile?.name || "");
                        setProfileImage(profile?.profileImage || "");
                        setPhone(profile?.phone || "");
                        setCountryOfResidence(profile?.countryOfResidence || "");
                        setPreferredLanguage(profile?.preferredLanguage || "english");
                        setBio(profile?.bio || "");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!isDirty || saving}>
                      <Save className="size-4 mr-2" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-readonly">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                      <Input id="name-readonly" value={profile?.name || ""} className="pl-9 bg-slate-50" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                      <Input id="email" value={profile?.email || ""} className="pl-9 bg-slate-50" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Sign-in Provider</Label>
                    <Input id="provider" value={profile?.provider || "local"} className="bg-slate-50 capitalize" disabled />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone-readonly">Phone</Label>
                      <Input id="phone-readonly" value={profile?.phone || "Not set"} className="bg-slate-50" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country-readonly">Country of Residence</Label>
                      <Input id="country-readonly" value={profile?.countryOfResidence || "Not set"} className="bg-slate-50" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language-readonly">Preferred Language</Label>
                    <Input id="language-readonly" value={profile?.preferredLanguage || "english"} className="bg-slate-50 capitalize" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio-readonly">Bio</Label>
                    <textarea
                      id="bio-readonly"
                      value={profile?.bio || "Not set"}
                      rows={4}
                      className="w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm resize-none"
                      disabled
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-slate-900">Plan Details</CardTitle>
                <CardDescription>Subscription and billing lifecycle</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")}>
                <Pencil className="size-4 mr-2" />
                Manage
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-1">Current Plan</p>
                <p className="text-lg text-slate-900">{subscription?.plan || "FREE"}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CalendarDays className="size-4 text-slate-500" />
                  <span>Start: {formatDate(subscription?.currentPeriodStart)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CalendarDays className="size-4 text-slate-500" />
                  <span>Renewal: {formatDate(subscription?.currentPeriodEnd)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-1">Usage</p>
                <p className="text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-blue-600" />
                  Queries used: {profile?.usage?.queriesUsed ?? 0}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Last reset: {formatDate(profile?.usage?.lastReset)}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Member since {formatDate(profile?.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Change Password</CardTitle>
              <CardDescription>Update your account password securely</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Current Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                    >
                      {showOldPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input
                      id="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-red-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Account Actions</CardTitle>
              <CardDescription>Session and account-level controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="size-4 mr-2" />
                Logout
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={deletingAccount}
                  >
                    <Trash2 className="size-4 mr-2" />
                    {deletingAccount ? "Deleting..." : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. Your profile and account data will be removed permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                    >
                      Yes, delete account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-red-600">
                Deleting account is permanent. Your profile and subscription mapping will be removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
