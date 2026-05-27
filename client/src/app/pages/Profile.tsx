import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User, Mail, Image as ImageIcon, Save, Pencil, Crown, CalendarDays, Sparkles, LogOut, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { LegalAcceptanceGate } from "../components/LegalAcceptanceGate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { IOS_EXTERNAL_PURCHASES_DISABLED } from "../../config/appConfig";
import { acceptTerms, clearStoredAuth, deleteAccount, getMySubscription, getUserProfile, requestCountryChange, updateUserProfile } from "../../utils/api";
import { CURRENT_POLICY_VERSION } from "../../config/legal";
import { COUNTRY_OPTIONS, detectUserCountry } from "../utils/countries";
import { getPlanLabel, type SubscriptionMe } from "../../utils/subscription";

type ProfileData = {
  name: string;
  email: string;
  profileImage?: string;
  phone?: string;
  countryOfResidence?: string;
  countryCode?: string;
  countryLocked?: boolean;
  countryApprovalStatus?: "none" | "pending" | "approved" | "rejected";
  countryChangeStatus?: "none" | "pending" | "approved" | "rejected";
  countryChangeRequest?: {
    requestedCountry?: string;
    requestedCountryCode?: string;
    reason?: string;
    status?: string;
    requestedAt?: string;
    reviewedAt?: string;
    decisionNotes?: string;
  } | null;
  termsAccepted?: boolean;
  termsAcceptedAt?: string | null;
  acceptedAt?: string | null;
  acceptedIp?: string;
  initialCountry?: string;
  initialCountryName?: string;
  preferredLanguage?: "english" | "hindi" | "tamil" | "indonesian";
  bio?: string;
  linkedinProfile?: string;
  provider?: "local" | "google" | "apple" | "linkedin";
  usage?: {
    queriesUsed?: number;
    lastReset?: string;
  };
  createdAt?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const PROFILE_IMAGE_OUTPUT_SIZE = 320;
const LINKEDIN_URL_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;
const DELETE_ACCOUNT_CONFIRMATION_TEXT = "DELETE MY ACCOUNT";

const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Selected file could not be processed as an image."));
    image.src = dataUrl;
  });

const canvasToDataUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) => {
    const preferredFormat = canvas.toDataURL("image/webp", 0.9);
    if (preferredFormat && preferredFormat.startsWith("data:image/webp")) {
      resolve(preferredFormat);
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Selected file could not be processed as an image."));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          if (!result.startsWith("data:image/")) {
            reject(new Error("Selected file could not be processed as an image."));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(new Error("Failed to read the selected image."));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.9
    );
  });

const normalizeProfileImage = async (dataUrl: string) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_OUTPUT_SIZE;
  canvas.height = PROFILE_IMAGE_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image processing is not available in this browser.");
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, (sourceWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (sourceHeight - sourceSize) / 2);

  context.clearRect(0, 0, PROFILE_IMAGE_OUTPUT_SIZE, PROFILE_IMAGE_OUTPUT_SIZE);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    PROFILE_IMAGE_OUTPUT_SIZE,
    PROFILE_IMAGE_OUTPUT_SIZE
  );

  return canvasToDataUrl(canvas);
};

export function Profile() {
  // Android only
  const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || null) as { returnTo?: string } | null;
  const token = localStorage.getItem("token");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storedUser = useMemo<ProfileData | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionMe | null>(null);
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [phone, setPhone] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"english" | "hindi" | "tamil" | "indonesian">("english");
  const [bio, setBio] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestingCountryChange, setRequestingCountryChange] = useState(false);
  const [acceptingLegal, setAcceptingLegal] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [isProfileImagePreviewOpen, setIsProfileImagePreviewOpen] = useState(false);
  const [requestedCountryCode, setRequestedCountryCode] = useState("");
  const [countryChangeReason, setCountryChangeReason] = useState("");
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState<"phrase" | "confirm">("phrase");
  const [deleteAccountConfirmationInput, setDeleteAccountConfirmationInput] = useState("");
  const [deleteAccountDialogError, setDeleteAccountDialogError] = useState("");
  // Android only
  const androidCardStyle = isNative
    ? {
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "14px",
        color: "#ffffff",
      }
    : undefined;
  // Android only
  const androidMutedTextStyle = isNative ? { color: "rgba(255,255,255,0.45)" } : undefined;
  // Android only
  const androidSecondaryTextStyle = isNative ? { color: "rgba(255,255,255,0.6)" } : undefined;
  // Android only
  const androidSurfaceStyle = isNative
    ? {
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#ffffff",
      }
    : undefined;

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      name.trim() !== profile.name.trim() ||
      (profileImage || "").trim() !== (profile.profileImage || "").trim() ||
      phone.trim() !== (profile.phone || "").trim() ||
      preferredLanguage !== (profile.preferredLanguage || "english") ||
      bio.trim() !== (profile.bio || "").trim() ||
      linkedinProfile.trim() !== (profile.linkedinProfile || "").trim()
    );
  }, [name, profileImage, phone, preferredLanguage, bio, linkedinProfile, profile]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    let active = true;

    const applyProfileData = (data: ProfileData, nextSubscription: SubscriptionMe | null) => {
      setProfile(data);
      setName(data.name || "");
      setProfileImage(data.profileImage || "");
      setPhone(data.phone || "");
      setCountryOfResidence(data.countryOfResidence || detectUserCountry());
      setRequestedCountryCode(data.countryCode || "");
      setPreferredLanguage(data.preferredLanguage || "english");
      setBio(data.bio || "");
      setLinkedinProfile(data.linkedinProfile || "");
      setSubscription(nextSubscription);
      setProfileLoadFailed(false);
      if (typeof window !== "undefined") {
        const storedUserRaw = localStorage.getItem("user");
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
        const nextStoredUser = { ...storedUser, ...data };
        localStorage.setItem("user", JSON.stringify(nextStoredUser));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("auth-changed"));
        window.dispatchEvent(new Event("user-updated"));
      }
    };

    if (storedUser) {
      applyProfileData(storedUser, null);
    }

    const fetchSubscription = async () => {
      if (!active) return;
      setSubscriptionLoading(true);
      try {
        const response = await getMySubscription();
        if (!active) return;
        setSubscription(response || null);
      } catch (subscriptionError) {
        if (!active) return;
        console.error("subscription status load failed", subscriptionError);
      } finally {
        if (active) {
          setSubscriptionLoading(false);
        }
      }
    };

    const fetchProfile = async (attempt = 0) => {
      if (!active) return;
      setLoading(attempt === 0);
      setRetryingProfile(attempt > 0);
      setError("");

      const profileResponse = await getUserProfile().then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      );

      if (!active) return;

      if (profileResponse.status === "rejected") {
        const status = profileResponse.reason?.response?.status;
        if (status === 401) {
          // Android only
          clearStoredAuth();
          navigate("/login");
          return;
        }

        if (attempt < 1) {
          window.setTimeout(() => {
            if (active) void fetchProfile(attempt + 1);
          }, 350);
          return;
        }

        setProfileLoadFailed(true);
        setError(
          profileResponse.reason?.response?.data?.message ||
            profileResponse.reason?.message ||
            "Failed to load profile. Please retry."
        );
      } else {
        const data = profileResponse.value?.data;
        if (!data) {
          setProfileLoadFailed(true);
          setError("Unable to load profile data.");
        } else {
          applyProfileData(data, subscription);
          void fetchSubscription();
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
  }, [navigate, storedUser, token]);

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
    if (!linkedinProfile.trim()) {
      setError("LinkedIn profile is required.");
      return;
    }
    if (!LINKEDIN_URL_PATTERN.test(linkedinProfile.trim())) {
      setError("LinkedIn profile must be a valid linkedin.com URL.");
      return;
    }
    if (profileImage && !profileImage.startsWith("http://") && !profileImage.startsWith("https://") && !profileImage.startsWith("data:image/")) {
      setError("Profile image must be a valid image URL or uploaded image file.");
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
        preferredLanguage,
        bio: bio.trim(),
        linkedinProfile: linkedinProfile.trim(),
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
      setLinkedinProfile(updated.linkedinProfile || "");
      setSuccessMessage("Profile updated successfully.");
      setIsEditingProfile(false);

      const storedUserRaw = localStorage.getItem("user");
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
      const nextStoredUser = { ...storedUser, ...updated };
      localStorage.setItem("user", JSON.stringify(nextStoredUser));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("user-updated"));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCountryChangeRequest = async () => {
    if (!requestedCountryCode || requestedCountryCode === profile?.countryCode) {
      setError("Please choose a different country before submitting the request.");
      return;
    }

    setRequestingCountryChange(true);
    setError("");
    setSuccessMessage("");
    try {
      await requestCountryChange({
        countryCode: requestedCountryCode,
        reason: countryChangeReason.trim(),
      });
      setSuccessMessage("Country change request submitted for admin approval.");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              countryApprovalStatus: "pending",
              countryChangeStatus: "pending",
            }
          : prev
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to submit country change request.");
    } finally {
      setRequestingCountryChange(false);
    }
  };

  const handleAcceptLegal = async () => {
    setAcceptingLegal(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await acceptTerms({
        termsAccepted: true,
        policyVersion: CURRENT_POLICY_VERSION,
      });
      const nextUser = response?.user || response?.data;
      if (nextUser) {
        setProfile(nextUser);
        const storedUserRaw = localStorage.getItem("user");
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
        localStorage.setItem("user", JSON.stringify({ ...storedUser, ...nextUser }));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("auth-changed"));
        window.dispatchEvent(new Event("user-updated"));
      }

      setSuccessMessage("Terms and Privacy Policy accepted successfully.");
      const returnTo = typeof routeState?.returnTo === "string" ? routeState.returnTo : "";
      if (returnTo) {
        window.setTimeout(() => navigate(returnTo, { replace: true }), 350);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to save legal acceptance right now.");
    } finally {
      setAcceptingLegal(false);
    }
  };

  const handleProfileImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
      setError("Please choose a PNG, JPG, WEBP, or GIF image.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setError("Profile image must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setError("Selected file could not be processed as an image.");
        return;
      }
      try {
        const normalizedImage = await normalizeProfileImage(result);
        setError("");
        setProfileImage(normalizedImage);
      } catch (imageError: any) {
        setError(imageError?.message || "Selected file could not be processed as an image.");
      }
    };
    reader.onerror = () => {
      setError("Failed to read the selected image.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearProfileImage = () => {
    setProfileImage("");
    setError("");
    setIsEditingProfile(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLogout = () => {
    // Android only
    clearStoredAuth();
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setError("");
    setSuccessMessage("");

    try {
      await deleteAccount();
      // Android only
      clearStoredAuth();
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const resetDeleteAccountDialog = () => {
    setDeleteAccountStep("phrase");
    setDeleteAccountConfirmationInput("");
    setDeleteAccountDialogError("");
  };

  const handleDeleteAccountDialogOpenChange = (open: boolean) => {
    setIsDeleteAccountDialogOpen(open);
    if (!open && !deletingAccount) {
      resetDeleteAccountDialog();
    }
  };

  const handleDeleteAccountPhraseSubmit = () => {
    if (deleteAccountConfirmationInput.trim() !== DELETE_ACCOUNT_CONFIRMATION_TEXT) {
      setDeleteAccountDialogError(`Please type "${DELETE_ACCOUNT_CONFIRMATION_TEXT}" exactly to continue.`);
      return;
    }

    setDeleteAccountDialogError("");
    setDeleteAccountStep("confirm");
  };

  const handleDeleteAccountCancel = () => {
    if (deletingAccount) return;
    setIsDeleteAccountDialogOpen(false);
    resetDeleteAccountDialog();
  };

  return (
    <div
      className="py-16 text-white"
      style={
        isNative
          ? {
              background: "linear-gradient(160deg, #0a1f5c 0%, #0d2878 40%, #0a1a4a 100%)",
              minHeight: "100dvh",
              color: "#ffffff",
              paddingBottom: "calc(60px + env(safe-area-inset-bottom, 16px))",
            }
          : undefined
      }
    >
      {isProfileImagePreviewOpen && profileImage ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/82 p-6 backdrop-blur-sm"
          onClick={() => setIsProfileImagePreviewOpen(false)}
          aria-label="Close profile photo preview"
        >
          <img
            src={profileImage}
            alt={profile?.name || "User"}
            className="max-h-[85vh] w-auto max-w-[min(90vw,36rem)] rounded-[2rem] border border-white/15 object-contain shadow-2xl"
            onError={() => {
              setIsProfileImagePreviewOpen(false);
              setProfileImage("");
            }}
          />
        </button>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={handleProfileImageFileChange}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card className="rounded-2xl border border-white/10 shadow-sm bg-[#132040]/88" style={androidCardStyle}>
          <CardContent className="p-6 sm:p-8">
            {loading ? (
              <p className="text-white/70">Loading profile...</p>
            ) : profileLoadFailed && !profile ? (
              <div className="space-y-3">
                <p className="text-white">We could not load your profile details.</p>
                <p className="text-sm text-white/70">
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (profileImage) {
                          setIsProfileImagePreviewOpen(true);
                        }
                      }}
                      className={`size-16 rounded-full bg-[#2563eb]/12 border border-[#2563eb]/40 overflow-hidden flex items-center justify-center transition ${
                        profileImage ? "cursor-zoom-in hover:border-[#2563eb]" : "cursor-default"
                      }`}
                      aria-label={profileImage ? "Preview profile photo" : "Profile photo"}
                    >
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt={profile?.name || "User"}
                          className="h-full w-full object-cover"
                          onError={() => setProfileImage("")}
                        />
                      ) : (
                        <User className="size-8 text-[#2563eb]" />
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute -right-1 -bottom-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0f1e35] text-white shadow-sm transition hover:border-[#2563eb] hover:text-[#60a5fa]"
                          aria-label="Edit profile photo"
                          title="Edit profile photo"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem
                          onClick={() => {
                            setIsEditingProfile(true);
                            window.setTimeout(() => fileInputRef.current?.click(), 0);
                          }}
                        >
                          Upload From Desktop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={clearProfileImage}>
                          Use Default Picture
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={clearProfileImage} disabled={!profileImage}>
                          Remove Current Profile Photo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <p className="text-sm text-white/55" style={androidMutedTextStyle}>WELCOME</p>
                    <h1 className="text-2xl text-white sm:text-3xl" style={isNative ? { fontSize: "20px", fontWeight: 700 } : undefined}>{profile?.name}</h1>
                    <p className="text-white/80" style={isNative ? { color: "rgba(255,255,255,0.7)", fontSize: "12px" } : undefined}>{profile?.email}</p>
                    <p className="mt-1 text-xs text-white/55" style={androidMutedTextStyle}>
                      Click the photo to preview it. Use the pencil button to change it.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className="border-[#2563eb]/40 bg-[#2563eb]/12 text-white"
                    style={isNative ? { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff" } : undefined}
                  >
                    <Crown className="size-3 mr-1" />
                    {getPlanLabel(subscription?.plan)} Plan
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
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
          <p className="rounded-md border border-[#2563eb]/40 bg-[#2563eb]/12 px-3 py-2 text-sm text-white">
            {successMessage}
          </p>
        )}
        {(!profile?.termsAccepted || !profile?.acceptedAt) ? (
          <LegalAcceptanceGate
            variant="inline"
            onAccept={handleAcceptLegal}
            loading={acceptingLegal}
            title="Finish legal acceptance before using chat and Yukti"
            description="Your account needs a one-time acceptance of the current Terms & Conditions and Privacy Policy before protected AI workflows can continue."
          />
        ) : null}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-white/10 shadow-sm" style={androidCardStyle}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-white" style={isNative ? { color: "#ffffff" } : undefined}>User Details</CardTitle>
                <CardDescription style={androidSecondaryTextStyle}>Basic identity and account details</CardDescription>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                  style={isNative ? { color: "#4285F4", background: "transparent" } : undefined}
                >
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/55" />
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
                    <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
                    <Input
                      id="linkedinProfile"
                      value={linkedinProfile}
                      onChange={(e) => setLinkedinProfile(e.target.value)}
                      placeholder="https://www.linkedin.com/in/your-profile"
                      required
                    />
                    <p className="text-xs text-white/55">
                      This is required and must be a valid LinkedIn profile URL.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profileImage">Profile Image</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/55" />
                      <Input
                        id="profileImage"
                        value={profileImage}
                        onChange={(e) => setProfileImage(e.target.value)}
                        className="pl-9"
                        placeholder="Paste an image URL or upload from your device"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        Choose From Desktop
                      </Button>
                      <Button type="button" variant="ghost" onClick={clearProfileImage} disabled={!profileImage}>
                        Use Default Picture
                      </Button>
                    </div>
                    <p className="text-xs text-white/55">
                      Upload PNG, JPG, WEBP, or GIF up to 2 MB, or paste a public image URL.
                    </p>
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
                        disabled
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
                      <p className="text-xs text-white/60">
                        {`Country changes require approval. Current country: ${profile?.countryOfResidence || "Not set"}.`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredLanguage">Preferred Language</Label>
                    <select
                      id="preferredLanguage"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as "english" | "hindi" | "tamil" | "indonesian")}
                      className="h-12 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm text-white ring-offset-background"
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
                    <p className="text-right text-xs text-white/55">{bio.length}/240</p>
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
                        setLinkedinProfile(profile?.linkedinProfile || "");
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/55" />
                      <Input id="name-readonly" value={profile?.name || ""} className="pl-9" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/55" />
                      <Input id="email" value={profile?.email || ""} className="pl-9" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin-readonly">LinkedIn Profile</Label>
                    <Input
                      id="linkedin-readonly"
                      value={profile?.linkedinProfile || "Not set"}
                      className=""
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Sign-in Provider</Label>
                    <Input id="provider" value={profile?.provider || "local"} className="capitalize" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-readonly">Legal Acceptance</Label>
                    <Input
                      id="legal-readonly"
                      value={
                        profile?.termsAccepted
                          ? `Accepted on ${formatDate(profile?.termsAcceptedAt || profile?.acceptedAt || null)}`
                          : "Pending acceptance"
                      }
                      disabled
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone-readonly">Phone</Label>
                      <Input id="phone-readonly" value={profile?.phone || "Not set"} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country-readonly">Country of Residence</Label>
                      <Input id="country-readonly" value={profile?.countryOfResidence || "Not set"} className="bg-[#F7FAFC]" disabled />
                      <p className="text-xs text-[#475569]" style={androidSecondaryTextStyle}>
                        {profile?.countryLocked ? `Country locked at signup (${profile.countryCode || "N/A"}).` : "Country changes require approval."}
                      </p>
                    </div>
                  </div>
                  {profile?.countryLocked ? (
                    <div
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      style={
                        isNative
                          ? {
                              background: "rgba(255,255,255,0.10)",
                              border: "1px solid rgba(255,255,255,0.18)",
                              color: "#ffffff",
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>Request country change</p>
                          <p className="text-xs text-[#475569]" style={androidSecondaryTextStyle}>
                            Pricing, tax workflow, and AI compliance behavior are tied to your signup country.
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {profile.countryApprovalStatus || profile.countryChangeStatus || "none"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <select
                          value={requestedCountryCode}
                          onChange={(e) => setRequestedCountryCode(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          style={androidSurfaceStyle}
                        >
                          <option value="">Select requested country</option>
                          {COUNTRY_OPTIONS.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <Button type="button" onClick={() => void handleCountryChangeRequest()} disabled={requestingCountryChange}>
                          {requestingCountryChange ? "Submitting..." : "Submit Request"}
                        </Button>
                      </div>
                      <textarea
                        value={countryChangeReason}
                        onChange={(e) => setCountryChangeReason(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        style={androidSurfaceStyle}
                        placeholder="Reason for changing your locked country"
                      />
                    </div>
                  ) : null}
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

          <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm" style={androidCardStyle}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>Plan Details</CardTitle>
                <CardDescription style={androidSecondaryTextStyle}>Subscription and billing lifecycle</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/pricing")}
                style={isNative ? { color: "#4285F4", background: "transparent" } : undefined}
              >
                <Pencil className="size-4 mr-2" />
                {IOS_EXTERNAL_PURCHASES_DISABLED ? "View Access" : "Manage"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#E2E8F0] p-3" style={androidSurfaceStyle}>
                <p className="text-xs text-[#0F172A] mb-1" style={androidSecondaryTextStyle}>Current Plan</p>
                <p className="text-lg text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>{subscriptionLoading ? "Loading..." : getPlanLabel(subscription?.plan)}</p>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] p-3 space-y-3" style={androidSurfaceStyle}>
                <div className="flex items-center gap-2 text-sm text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>
                  <CalendarDays className="size-4 text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined} />
                  <span>Start: {formatDate(subscription?.subscriptionStartDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>
                  <CalendarDays className="size-4 text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined} />
                  <span>Renewal: {formatDate(subscription?.subscriptionEndDate)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] p-3" style={androidSurfaceStyle}>
                <p className="text-xs text-[#0F172A] mb-1" style={androidSecondaryTextStyle}>Usage</p>
                <p className="text-[#0F172A] flex items-center gap-2" style={isNative ? { color: "#ffffff" } : undefined}>
                  <Sparkles className="size-4 text-[#2563eb]" />
                  Chat used this month: {subscription?.usage?.chatUsageCount ?? 0}
                </p>
                <p className="text-xs text-[#0F172A] mt-2" style={androidSecondaryTextStyle}>
                  Remaining messages: {subscription?.remaining?.chatMessages === null ? "Unlimited" : subscription?.remaining?.chatMessages ?? 0}
                </p>
              </div>

              <p className="text-xs text-[#0F172A]" style={androidMutedTextStyle}>
                Member since {formatDate(profile?.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border border-red-200 shadow-sm lg:col-start-3" style={androidCardStyle}>
            <CardHeader>
              <CardTitle className="text-[#0F172A]" style={isNative ? { color: "#ffffff" } : undefined}>Account Actions</CardTitle>
              <CardDescription style={androidSecondaryTextStyle}>Session and account-level controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="size-4 mr-2" />
                Logout
              </Button>
              <AlertDialog open={isDeleteAccountDialogOpen} onOpenChange={handleDeleteAccountDialogOpenChange}>
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
                    <AlertDialogTitle>
                      {deleteAccountStep === "phrase" ? "Verify account deletion" : "Confirm account deletion"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {deleteAccountStep === "phrase"
                        ? `To continue, type the exact phrase "${DELETE_ACCOUNT_CONFIRMATION_TEXT}" so we know this is an intentional request.`
                        : "This is your final confirmation. Your profile and account data will be removed permanently."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteAccountStep === "phrase" ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="delete-account-confirmation">Type the phrase exactly</Label>
                        <Input
                          id="delete-account-confirmation"
                          value={deleteAccountConfirmationInput}
                          onChange={(event) => {
                            setDeleteAccountConfirmationInput(event.target.value);
                            if (deleteAccountDialogError) {
                              setDeleteAccountDialogError("");
                            }
                          }}
                          placeholder={DELETE_ACCOUNT_CONFIRMATION_TEXT}
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                        />
                      </div>
                      {deleteAccountDialogError ? (
                        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {deleteAccountDialogError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      This action cannot be undone. Please confirm one more time to delete your account.
                    </div>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleDeleteAccountCancel} disabled={deletingAccount}>
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={deleteAccountStep === "phrase" ? handleDeleteAccountPhraseSubmit : handleDeleteAccount}
                      disabled={
                        deletingAccount ||
                        (deleteAccountStep === "phrase" && deleteAccountConfirmationInput.trim() !== DELETE_ACCOUNT_CONFIRMATION_TEXT)
                      }
                      className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                    >
                      {deleteAccountStep === "phrase"
                        ? "Continue"
                        : deletingAccount
                          ? "Deleting..."
                          : "Yes, delete account"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-red-600" style={isNative ? { color: "rgba(255,255,255,0.6)" } : undefined}>
                Deleting account is permanent. Your profile and subscription mapping will be removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}











