import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Image as ImageIcon, Save, Pencil, Crown, CalendarDays, Sparkles, LockKeyhole, LogOut, Trash2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
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
import { COUNTRY_OPTIONS, detectUserCountry } from "../utils/countries";

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
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const requiresCurrentPassword = profile?.provider !== "google";

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

    const applyProfileData = (data: ProfileData, nextSubscription: SubscriptionData | null) => {
      setProfile(data);
      setName(data.name || "");
      setProfileImage(data.profileImage || "");
      setPhone(data.phone || "");
      setCountryOfResidence(data.countryOfResidence || detectUserCountry());
      setPreferredLanguage(data.preferredLanguage || "english");
      setBio(data.bio || "");
      setSubscription(nextSubscription);
      setProfileLoadFailed(false);
    };

    const fetchProfile = async (attempt = 0) => {
      if (!active) return;
      setLoading(attempt === 0);
      setRetryingProfile(attempt > 0);
      setError("");

      const [profileResponse, subscriptionResponse] = await Promise.allSettled([
        getUserProfile(),
        getSubscriptionStatus(),
      ]);

      if (!active) return;

      if (profileResponse.status === "rejected") {
        const status = profileResponse.reason?.response?.status;
        if (status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("storage"));
          window.dispatchEvent(new Event("auth-changed"));
          navigate("/login");
          return;
        }

        if (attempt < 1) {
          window.setTimeout(() => {
            if (active) void fetchProfile(attempt + 1);
          }, 900);
          return;
        }

        setProfileLoadFailed(true);
        setError(profileResponse.reason?.response?.data?.message || "Failed to load profile. Please retry.");
      } else {
        const data = profileResponse.value?.data;
        if (!data) {
          setProfileLoadFailed(true);
          setError("Unable to load profile data.");
        } else {
          const nextSubscription =
            subscriptionResponse.status === "fulfilled"
              ? subscriptionResponse.value?.subscription || null
              : null;

          if (subscriptionResponse.status === "rejected") {
            console.error("subscription status load failed", subscriptionResponse.reason);
          }

          applyProfileData(data, nextSubscription);
        }
      }

      if (active) {
        setLoading(false);
        setRetryingProfile(false);
      }
    };

    void fetchProfile();
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
    setPasswordError("");
    setPasswordSuccess("");

    if (!passwordForm.newPassword || !passwordForm.confirmNewPassword || (requiresCurrentPassword && !passwordForm.oldPassword)) {
      setPasswordError(
        requiresCurrentPassword
          ? "Please fill current, new, and confirm password fields."
          : "Please fill new and confirm password fields."
      );
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (requiresCurrentPassword && passwordForm.oldPassword === passwordForm.newPassword) {
      setPasswordError("Current password and new password cannot be the same.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("New password and confirm new password do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword({
        oldPassword: passwordForm.oldPassword || undefined,
        newPassword: passwordForm.newPassword,
        confirmNewPassword: passwordForm.confirmNewPassword,
      });
      setPasswordSuccess("Password updated successfully.");
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || "Failed to change password.");
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
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm bg-[#F7FAFC]/90">
          <CardContent className="p-6 sm:p-8">
            {loading ? (
              <p className="text-[#0F172A]">Loading profile...</p>
            ) : profileLoadFailed && !profile ? (
              <div className="space-y-3">
                <p className="text-[#0F172A]">We could not load your profile details.</p>
                <p className="text-sm text-[#0F172A]">
                  This usually means the profile API failed, auth state expired, or local session data is stale.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => window.location.reload()} disabled={retryingProfile}>
                    {retryingProfile ? "Retrying..." : "Try Again"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-full bg-[#2563eb]/12 border border-[#2563eb]/40 overflow-hidden flex items-center justify-center">
                    {profileImage ? (
                      <img src={profileImage} alt={profile?.name || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <User className="size-8 text-[#2563eb]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-[#0F172A]">Welcome back</p>
                    <h1 className="text-2xl sm:text-3xl text-[#0F172A]">{profile?.name}</h1>
                    <p className="text-[#0F172A]">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-[#2563eb]/12 text-[#0F172A] border-[#2563eb]/40">
                    <Crown className="size-3 mr-1" />
                    {subscription?.plan || "FREE"} Plan
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            <p>{error}</p>
            {profileLoadFailed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.location.reload()}
                disabled={retryingProfile}
              >
                {retryingProfile ? "Retrying..." : "Retry Profile Load"}
              </Button>
            ) : null}
          </div>
        )}
        {successMessage && (
          <p className="rounded-md border border-[#2563eb]/40 bg-[#2563eb]/12 px-3 py-2 text-sm text-[#2563eb]">
            {successMessage}
          </p>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-[#E2E8F0] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-[#0F172A]">User Details</CardTitle>
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
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
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
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
                      <Select
                        value={countryOfResidence}
                        onValueChange={setCountryOfResidence}
                      >
                        <SelectTrigger id="countryOfResidence">
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
                      <p className="text-xs text-[#0F172A]">
                        {countryOfResidence
                          ? `Selected: ${countryOfResidence}`
                          : "Auto-detect will be used when available, with manual selection as fallback."}
                      </p>
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
                    <p className="text-xs text-[#0F172A] text-right">{bio.length}/240</p>
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
                      <Input id="name-readonly" value={profile?.name || ""} className="pl-9 bg-[#F7FAFC]" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
                      <Input id="email" value={profile?.email || ""} className="pl-9 bg-[#F7FAFC]" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Sign-in Provider</Label>
                    <Input id="provider" value={profile?.provider || "local"} className="bg-[#F7FAFC] capitalize" disabled />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone-readonly">Phone</Label>
                      <Input id="phone-readonly" value={profile?.phone || "Not set"} className="bg-[#F7FAFC]" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country-readonly">Country of Residence</Label>
                      <Input id="country-readonly" value={profile?.countryOfResidence || "Not set"} className="bg-[#F7FAFC]" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language-readonly">Preferred Language</Label>
                    <Input id="language-readonly" value={profile?.preferredLanguage || "english"} className="bg-[#F7FAFC] capitalize" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio-readonly">Bio</Label>
                    <textarea
                      id="bio-readonly"
                      value={profile?.bio || "Not set"}
                      rows={4}
                      className="w-full rounded-md border border-input bg-[#F7FAFC] px-3 py-2 text-sm resize-none"
                      disabled
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-[#0F172A]">Plan Details</CardTitle>
                <CardDescription>Subscription and billing lifecycle</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")}>
                <Pencil className="size-4 mr-2" />
                Manage
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#0F172A] mb-1">Current Plan</p>
                <p className="text-lg text-[#0F172A]">{subscription?.plan || "FREE"}</p>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <CalendarDays className="size-4 text-[#0F172A]" />
                  <span>Start: {formatDate(subscription?.currentPeriodStart)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <CalendarDays className="size-4 text-[#0F172A]" />
                  <span>Renewal: {formatDate(subscription?.currentPeriodEnd)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] p-3">
                <p className="text-xs text-[#0F172A] mb-1">Usage</p>
                <p className="text-[#0F172A] flex items-center gap-2">
                  <Sparkles className="size-4 text-[#2563eb]" />
                  Queries used: {profile?.usage?.queriesUsed ?? 0}
                </p>
                <p className="text-xs text-[#0F172A] mt-2">
                  Last reset: {formatDate(profile?.usage?.lastReset)}
                </p>
              </div>

              <p className="text-xs text-[#0F172A]">
                Member since {formatDate(profile?.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#0F172A]">Change Password</CardTitle>
              <CardDescription>Update your account password securely</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {requiresCurrentPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={passwordForm.oldPassword}
                      onChange={(e) => {
                        setPasswordError("");
                        setPasswordSuccess("");
                        setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }));
                      }}
                      className="pl-9 pr-10"
                      autoComplete="current-password"
                    />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F172A]"
                        aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                      >
                        {showOldPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => {
                        setPasswordError("");
                        setPasswordSuccess("");
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }));
                      }}
                      className="pl-9 pr-10"
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F172A]"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F172A]" />
                    <Input
                      id="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => {
                        setPasswordError("");
                        setPasswordSuccess("");
                        setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }));
                      }}
                      className="pl-9 pr-10"
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F172A]"
                      aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="rounded-md border border-[#2563eb]/40 bg-[#2563eb]/12 px-3 py-2 text-sm text-[#2563eb]">{passwordSuccess}</p>
                )}
                <p className="text-xs text-[#0F172A]">
                  Use at least 6 characters. Confirm password must match exactly.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      changingPassword ||
                      !passwordForm.newPassword ||
                      !passwordForm.confirmNewPassword ||
                      (requiresCurrentPassword && !passwordForm.oldPassword)
                    }
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-red-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#0F172A]">Account Actions</CardTitle>
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











