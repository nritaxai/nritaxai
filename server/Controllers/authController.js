import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { generateToken } from "../Utils/generateToken.js";
import User from "../Models/userModel.js";
import { sendEmail } from "../src/utils/emailService.js";
import { getSubscriptionSummary, normalizeUserSubscriptionState } from "../Utils/subscriptionAccess.js";

const PROFILE_LANGUAGES = new Set(["english", "hindi", "tamil", "indonesian"]);
const PROFILE_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
const MAX_PROFILE_IMAGE_LENGTH = 2_800_000;

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");
const sanitizeEmail = (value) => sanitizeString(value).toLowerCase();
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_ENDPOINT = "https://appleid.apple.com/auth/keys";
const APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const LINKEDIN_TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_SCOPE = "openid profile email";
let appleSigningKeysCache = { keys: [], fetchedAt: 0 };

const logAuthError = (action, error, context = {}) => {
  console.error(`[auth:${action}]`, {
    message: error?.message || String(error),
    stack: error?.stack,
    ...context,
  });
};

const parseJwtPart = (value = "") => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
};

const decodeJwtPayload = (token = "") => {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const header = JSON.parse(parseJwtPart(parts[0]));
  const payload = JSON.parse(parseJwtPart(parts[1]));
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
};

const getAppleSigningKeys = async () => {
  const now = Date.now();
  if (appleSigningKeysCache.keys.length && now - appleSigningKeysCache.fetchedAt < 6 * 60 * 60 * 1000) {
    return appleSigningKeysCache.keys;
  }

  const response = await fetch(APPLE_KEYS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple signing keys: ${response.status}`);
  }

  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (!keys.length) throw new Error("Apple signing keys missing");

  appleSigningKeysCache = { keys, fetchedAt: now };
  return keys;
};

const verifyAppleIdentityToken = async (identityToken) => {
  const { header, payload, signingInput, signature } = decodeJwtPayload(identityToken);
  if (header?.alg !== "RS256") throw new Error("Unexpected Apple token algorithm");

  const keys = await getAppleSigningKeys();
  const jwk = keys.find((row) => row?.kid === header?.kid && row?.alg === "RS256");
  if (!jwk) throw new Error("Apple signing key not found for token");

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  const signatureBuffer = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const isValidSignature = verifier.verify(publicKey, signatureBuffer);
  if (!isValidSignature) throw new Error("Invalid Apple token signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss !== APPLE_ISSUER) throw new Error("Invalid Apple token issuer");

  const allowedAudiences = [
    process.env.APPLE_CLIENT_ID,
    process.env.APPLE_WEB_CLIENT_ID,
    process.env.APPLE_SERVICE_ID,
  ].filter(Boolean);
  if (!allowedAudiences.length) throw new Error("Apple client ID is not configured");
  if (!allowedAudiences.includes(payload?.aud)) throw new Error("Invalid Apple token audience");

  if (!payload?.exp || payload.exp < now) throw new Error("Apple token expired");
  if (!payload?.sub) throw new Error("Apple token subject missing");

  return payload;
};

const buildAppleClientSecret = () => {
  const teamId = sanitizeString(process.env.APPLE_TEAM_ID);
  const keyId = sanitizeString(process.env.APPLE_KEY_ID);
  const clientId =
    sanitizeString(process.env.APPLE_CLIENT_ID) ||
    sanitizeString(process.env.APPLE_WEB_CLIENT_ID) ||
    sanitizeString(process.env.APPLE_SERVICE_ID);
  const privateKeyRaw = sanitizeString(process.env.APPLE_PRIVATE_KEY);

  if (!teamId || !keyId || !clientId || !privateKeyRaw) {
    throw new Error("Missing Apple client secret configuration");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: teamId,
      iat: now,
      exp: now + 5 * 60,
      aud: APPLE_ISSUER,
      sub: clientId,
    },
    privateKey,
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: keyId,
      },
    }
  );
};

const exchangeAppleAuthorizationCode = async (authorizationCode) => {
  const clientId =
    sanitizeString(process.env.APPLE_CLIENT_ID) ||
    sanitizeString(process.env.APPLE_WEB_CLIENT_ID) ||
    sanitizeString(process.env.APPLE_SERVICE_ID);

  if (!clientId) throw new Error("Apple client ID is not configured");

  const clientSecret = buildAppleClientSecret();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const redirectUri = sanitizeString(process.env.APPLE_REDIRECT_URI);
  if (redirectUri) {
    body.set("redirect_uri", redirectUri);
  }

  const response = await fetch(APPLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apple code exchange failed (${response.status}): ${text}`);
  }

  return response.json();
};

const exchangeLinkedInAuthorizationCode = async ({ code, redirectUri }) => {
  const clientId = sanitizeString(process.env.LINKEDIN_CLIENT_ID);
  const clientSecret = sanitizeString(process.env.LINKEDIN_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn OAuth is not configured");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(LINKEDIN_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LinkedIn token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
};

const getLinkedInUserInfo = async (accessToken) => {
  const response = await fetch(LINKEDIN_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LinkedIn user info failed (${response.status}): ${text}`);
  }

  return response.json();
};

const getLinkedInCallbackUri = (req) => {
  const configured = sanitizeString(process.env.LINKEDIN_REDIRECT_URI);
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}/auth/linkedin/callback`;
};

const getAllowedFrontendOrigins = () =>
  Array.from(
    new Set(
      [
        sanitizeString(process.env.FRONTEND_URL),
        sanitizeString(process.env.CLIENT_URL),
        sanitizeString(process.env.APP_URL),
        "https://www.nritax.ai",
        "https://nritax.ai",
        "http://localhost:5173",
      ].filter(Boolean)
    )
  );

const resolveFrontendOrigin = (requestedOrigin) => {
  const normalizedRequestedOrigin = sanitizeString(requestedOrigin).replace(/\/+$/, "");
  const allowedOrigins = getAllowedFrontendOrigins();
  if (normalizedRequestedOrigin && allowedOrigins.includes(normalizedRequestedOrigin)) {
    return normalizedRequestedOrigin;
  }
  return allowedOrigins[0] || "https://www.nritax.ai";
};

const encodeLinkedInState = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodeLinkedInState = (value) => {
  if (!value) return {};
  try {
    const decoded = Buffer.from(String(value), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    logAuthError("linkedin-state-parse", error);
    return {};
  }
};

const buildFrontendAuthRedirect = (frontendOrigin, params = {}) => {
  const redirectUrl = new URL(frontendOrigin);
  redirectUrl.search = "";
  redirectUrl.hash = "";
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      redirectUrl.searchParams.set(key, String(value));
    }
  });
  return redirectUrl.toString();
};

const completeLinkedInLogin = async ({ code, redirectUri }) => {
  const tokenResponse = await exchangeLinkedInAuthorizationCode({ code, redirectUri });
  const accessToken = sanitizeString(tokenResponse?.access_token);

  if (!accessToken) {
    throw new Error("LinkedIn access token missing");
  }

  const profile = await getLinkedInUserInfo(accessToken);
  const linkedinId = sanitizeString(profile?.sub);
  const email = sanitizeEmail(profile?.email);
  const name =
    sanitizeString(profile?.name) ||
    [sanitizeString(profile?.given_name), sanitizeString(profile?.family_name)].filter(Boolean).join(" ");
  const picture = sanitizeString(profile?.picture);

  if (!linkedinId) {
    throw new Error("LinkedIn user ID missing");
  }

  let user = null;
  let isNewUser = false;

  if (email) {
    user = await User.findOne({ email });
  }

  if (!user) {
    user = await User.findOne({ linkedinId });
  }

  if (!user) {
    user = await User.create({
      name: name || "LinkedIn User",
      email: email || `linkedin_${linkedinId}@users.nritax.ai`,
      linkedinId,
      profileImage: picture,
      provider: "linkedin",
    });
    isNewUser = true;
  } else {
    let changed = false;

    if (!user.linkedinId) {
      user.linkedinId = linkedinId;
      changed = true;
    }

    if ((!user.provider || user.provider === "local") && !user.googleId && !user.appleId) {
      user.provider = "linkedin";
      changed = true;
    }

    if (!user.profileImage && picture) {
      user.profileImage = picture;
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  const token = generateToken(user._id);

  if (isNewUser) {
    await trySendWelcomeEmail({ name: user.name, email: user.email });
  }

  return {
    token,
    user,
  };
};

const isValidProfileImage = (value) => {
  if (!value) return true;
  if (value.length > MAX_PROFILE_IMAGE_LENGTH) return false;
  if (PROFILE_IMAGE_DATA_URL_PATTERN.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizePhone = (value) => {
  const trimmed = sanitizeString(value);
  if (!trimmed) return "";
  return trimmed.replace(/[^\d+()\-\s]/g, "");
};

const isValidPhone = (value) => {
  if (!value) return true;
  return /^[\d+()\-\s]{7,20}$/.test(value);
};

const isValidLinkedInProfile = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return (hostname === "linkedin.com" || hostname === "www.linkedin.com") && parsed.pathname.length > 1;
  } catch {
    return false;
  }
};

const buildPasswordResetUrl = (req, token) => {
  const configuredBase =
    sanitizeString(process.env.FRONTEND_URL) ||
    sanitizeString(process.env.CLIENT_URL) ||
    sanitizeString(process.env.APP_URL);
  const originBase = sanitizeString(req.get("origin"));
  const fallbackBase = "http://localhost:5173";
  const appBase = configuredBase || originBase || fallbackBase;
  const normalizedBase = appBase.replace(/\/+$/, "");
  return `${normalizedBase}/reset-password?token=${encodeURIComponent(token)}`;
};

const sendWelcomeEmail = async ({ name, email }) => {
  const safeEmail = sanitizeEmail(email);
  if (!safeEmail) return;

  const safeName = sanitizeString(name) || "there";
  const appUrl =
    sanitizeString(process.env.FRONTEND_URL) ||
    sanitizeString(process.env.CLIENT_URL) ||
    sanitizeString(process.env.APP_URL) ||
    "https://www.nritax.ai";

  await sendEmail({
    to: safeEmail,
    subject: "Welcome to NRITAX.AI",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0F172A">
        <h2 style="margin-bottom:12px;">Welcome to NRITAX.AI</h2>
        <p>Hi ${safeName},</p>
        <p>Your account has been created successfully.</p>
        <p>You can now access NRITAX.AI and explore tax tools, pricing, and expert support.</p>
        <p>
          <a href="${appUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Open NRITAX.AI
          </a>
        </p>
        <p>If you did not create this account, please contact support immediately.</p>
        <p>Thank you,<br />Team NRITAX.AI</p>
      </div>
    `,
  });
};

const trySendWelcomeEmail = async ({ name, email }) => {
  try {
    await sendWelcomeEmail({ name, email });
  } catch (error) {
    logAuthError("welcome-email", error, { email });
  }
};

const toSafeUser = (userDoc) => {
  if (!userDoc) return null;
  normalizeUserSubscriptionState(userDoc);
  const user = typeof userDoc.toObject === "function" ? userDoc.toObject() : userDoc;
  const subscriptionSummary = getSubscriptionSummary(user);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || "",
    phone: user.phone || "",
    countryOfResidence: user.countryOfResidence || "",
    preferredLanguage: user.preferredLanguage || "english",
    bio: user.bio || "",
    linkedinProfile: user.linkedinProfile || "",
    provider: user.provider || "local",
    plan: user.plan || subscriptionSummary.plan,
    subscriptionStatus: user.subscriptionStatus || subscriptionSummary.subscriptionStatus,
    subscriptionStartDate: user.subscriptionStartDate || subscriptionSummary.subscriptionStartDate,
    subscriptionEndDate: user.subscriptionEndDate || subscriptionSummary.subscriptionEndDate,
    chatUsageCount: user.chatUsageCount ?? subscriptionSummary.usage.chatUsageCount,
    chatUsageMonth: user.chatUsageMonth || subscriptionSummary.usage.chatUsageMonth,
    cpaUsageCount: user.cpaUsageCount ?? subscriptionSummary.usage.cpaUsageCount,
    cpaUsageMonth: user.cpaUsageMonth || subscriptionSummary.usage.cpaUsageMonth,
    subscription: user.subscription,
    usage: user.usage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// -------------------------------- Google Login --------------------------------------------------------------

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "No Google credential provided",
      });
    }

    // Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload || {};
    const normalizedEmail = sanitizeEmail(email);

    if (!sub || !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Google account is missing a verified email address.",
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new Google user
      user = await User.create({
        name,
        email: normalizedEmail,
        googleId: sub,
        profileImage: picture,
        provider: "google",
      });
      await trySendWelcomeEmail({ name: user.name, email: user.email });
    } else {
      let changed = false;
      if (!user.googleId) {
        user.googleId = sub;
        changed = true;
      }
      if (!user.profileImage && picture) {
        user.profileImage = picture;
        changed = true;
      }
      if (!user.provider || user.provider === "local") {
        user.provider = "google";
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      user: toSafeUser(user),
      token,
    });

  } catch (error) {
    logAuthError("google-login", error, { email: req.body?.email || null });
    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

// -------------------------------- Apple Login --------------------------------------------------------------
export const appleLogin = async (req, res) => {
  try {
    const authorizationCode = sanitizeString(req.body?.authorizationCode || req.body?.code);
    let identityToken = sanitizeString(req.body?.identityToken || req.body?.idToken || req.body?.id_token);
    const appleUser = typeof req.body?.user === "object" && req.body?.user !== null ? req.body.user : null;
    const fullName =
      typeof req.body?.fullName === "object" && req.body?.fullName !== null
        ? req.body.fullName
        : appleUser?.name || {};

    if (!identityToken && authorizationCode) {
      const exchangeResult = await exchangeAppleAuthorizationCode(authorizationCode);
      identityToken = sanitizeString(exchangeResult?.id_token);
    }

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        message: "Missing Apple identity token",
      });
    }

    const payload = await verifyAppleIdentityToken(identityToken);
    const appleId = String(payload.sub);
    const email = sanitizeEmail(payload.email);

    let user = null;

    if (email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      user = await User.findOne({ appleId });
    }

    if (!user) {
      const parsedFirstName = sanitizeString(fullName?.firstName);
      const parsedLastName = sanitizeString(fullName?.lastName);
      const providedName = sanitizeString(req.body?.name);
      const fallbackName = [parsedFirstName, parsedLastName].filter(Boolean).join(" ");

      user = await User.create({
        name: fallbackName || providedName || "Apple User",
        email: email || `apple_${appleId}@privaterelay.appleid.com`,
        appleId,
        provider: "apple",
      });
      await trySendWelcomeEmail({ name: user.name, email: user.email });
    } else if (!user.appleId) {
      user.appleId = appleId;
      if (!user.provider || user.provider === "local") user.provider = "apple";
      await user.save();
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Apple login successful",
      user: toSafeUser(user),
      token,
    });
  } catch (error) {
    logAuthError("apple-login", error);
    return res.status(401).json({
      success: false,
      message: "Apple authentication failed",
      error: error?.message || "Unknown Apple authentication error",
    });
  }
};


// -------------------------------- Register --------------------------------------------------------------
export const registerUser = async (req, res) => {
  try {
    const name = sanitizeString(req.body?.name);
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    const linkedinProfile = sanitizeString(req.body?.linkedinProfile);

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please enter all required fields: Name, Email, Password, and Confirm Password."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (linkedinProfile && !isValidLinkedInProfile(linkedinProfile)) {
      return res.status(400).json({
        success: false,
        message: "LinkedIn profile must be a valid linkedin.com URL.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const newUser = new User({ name, email, password, linkedinProfile, provider: "local" });
    await newUser.save();
    await trySendWelcomeEmail({ name: newUser.name, email: newUser.email });

    const token = generateToken(newUser._id);
    return res.status(200).json({
      success: true,
      message: "User registered successfully.",
      user: toSafeUser(newUser),
      data: toSafeUser(newUser),
      token
    });

  } catch (error) {
    logAuthError("register", error, { email: req.body?.email || null });
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

// -------------------------------- Login --------------------------------------------------------------
export const loginUser = async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter Email and Password"
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email"
      });
    }

    // Accounts created with Google may not have a password yet.
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account has no password yet. Please use the original social sign-in method or set a password from Profile."
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: toSafeUser(user),
      token
    });

  } catch (error) {
    logAuthError("login", error, { email: req.body?.email || null });
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

// -------------------------------- Forgot Password --------------------------------------------------------------
export const forgotPassword = async (req, res) => {
  const email = sanitizeEmail(req.body?.email);

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email address.",
      });
    }

    const user = await User.findOne({ email }).select("+resetPasswordToken +resetPasswordExpires");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = buildPasswordResetUrl(req, rawToken);
    await sendEmail({
      to: user.email,
      subject: "Reset your NRITAX password",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0F172A">
          <h2 style="margin-bottom:12px;">Reset your password</h2>
          <p>We received a request to reset your NRITAX account password.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>If the button does not work, use this link:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent.",
    });
  } catch (error) {
    logAuthError("forgot-password", error, { email });
    return res.status(500).json({
      success: false,
      message: `Unable to send password reset email right now. ${error?.message || "Unknown mail error."}`,
    });
  }
};

// -------------------------------- LinkedIn Login --------------------------------------------------------------
export const startLinkedInAuth = async (req, res) => {
  try {
    const clientId = sanitizeString(process.env.LINKEDIN_CLIENT_ID);
    if (!clientId) {
      return res.status(500).json({
        success: false,
        message: "LinkedIn OAuth is not configured",
      });
    }

    const mode = sanitizeString(req.query?.mode) === "signup" ? "signup" : "login";
    const frontendOrigin = resolveFrontendOrigin(req.query?.origin);
    const redirectUri = getLinkedInCallbackUri(req);
    const state = encodeLinkedInState({ mode, frontendOrigin });
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", LINKEDIN_SCOPE);
    authUrl.searchParams.set("state", state);

    return res.redirect(authUrl.toString());
  } catch (error) {
    logAuthError("linkedin-start", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start LinkedIn authentication",
    });
  }
};

export const linkedinCallback = async (req, res) => {
  const statePayload = decodeLinkedInState(req.query?.state);
  const frontendOrigin = resolveFrontendOrigin(statePayload?.frontendOrigin);
  const mode = statePayload?.mode === "signup" ? "signup" : "login";
  try {
    const errorMessage = sanitizeString(req.query?.error_description || req.query?.error);
    if (errorMessage) {
      return res.redirect(
        buildFrontendAuthRedirect(frontendOrigin, {
          auth_provider: "linkedin",
          auth_mode: mode,
          auth_error: errorMessage,
        })
      );
    }

    const code = sanitizeString(req.query?.code);
    if (!code) {
      throw new Error("LinkedIn authorization code missing");
    }

    const redirectUri = getLinkedInCallbackUri(req);
    const { token, user } = await completeLinkedInLogin({ code, redirectUri });

    return res.redirect(
      buildFrontendAuthRedirect(frontendOrigin, {
        auth_provider: "linkedin",
        auth_mode: mode,
        token,
        user: JSON.stringify(toSafeUser(user)),
      })
    );
  } catch (error) {
    logAuthError("linkedin-callback", error);
    return res.redirect(
      buildFrontendAuthRedirect(frontendOrigin, {
        auth_provider: "linkedin",
        auth_mode: mode,
        auth_error: error?.message || "LinkedIn authentication failed",
      })
    );
  }
};

export const linkedinLogin = async (req, res) => {
  try {
    const code = sanitizeString(req.body?.code);
    const redirectUri = sanitizeString(req.body?.redirectUri);

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        message: "LinkedIn authorization code and redirect URI are required",
      });
    }

    const { token, user } = await completeLinkedInLogin({ code, redirectUri });

    return res.status(200).json({
      success: true,
      message: "LinkedIn login successful",
      user: toSafeUser(user),
      token,
    });
  } catch (error) {
    logAuthError("linkedin-login", error);
    return res.status(401).json({
      success: false,
      message: "LinkedIn authentication failed",
      error: error?.message || "Unknown LinkedIn authentication error",
    });
  }
};

// -------------------------------- Reset Password --------------------------------------------------------------
export const resetPassword = async (req, res) => {
  const token = sanitizeString(req.body?.token);
  const newPassword = sanitizeString(req.body?.newPassword);
  const confirmNewPassword = sanitizeString(req.body?.confirmNewPassword);

  try {
    if (!token || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, new password, and confirm password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or has expired.",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please sign in with your new password.",
    });
  } catch (error) {
    logAuthError("reset-password", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password right now.",
    });
  }
};

// -------------------------------- Get Profile --------------------------------------------------------------
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: toSafeUser(user)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// -------------------------------- Update Profile --------------------------------------------------------------
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const name = sanitizeString(req.body?.name);
    const profileImage = sanitizeString(req.body?.profileImage);
    const countryOfResidence = sanitizeString(req.body?.countryOfResidence);
    const preferredLanguage = sanitizeString(req.body?.preferredLanguage).toLowerCase();
    const bio = sanitizeString(req.body?.bio);
    const phone = normalizePhone(req.body?.phone);
    const linkedinProfile = sanitizeString(req.body?.linkedinProfile);

    if (name && name.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters.",
      });
    }

    if (name.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must be at most 80 characters.",
      });
    }

    if (!isValidProfileImage(profileImage)) {
      return res.status(400).json({
        success: false,
        message: "Profile image must be a valid image URL or uploaded image file.",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number format is invalid.",
      });
    }

    if (countryOfResidence.length > 56) {
      return res.status(400).json({
        success: false,
        message: "Country of residence is too long.",
      });
    }

    if (bio.length > 240) {
      return res.status(400).json({
        success: false,
        message: "Bio must be at most 240 characters.",
      });
    }

    if (linkedinProfile && !isValidLinkedInProfile(linkedinProfile)) {
      return res.status(400).json({
        success: false,
        message: "LinkedIn profile must be a valid linkedin.com URL.",
      });
    }

    if (preferredLanguage && !PROFILE_LANGUAGES.has(preferredLanguage)) {
      return res.status(400).json({
        success: false,
        message: "Preferred language is not supported.",
      });
    }

    user.name = name || user.name;
    user.profileImage = profileImage;
    user.phone = phone;
    user.countryOfResidence = countryOfResidence;
    user.bio = bio;
    if (linkedinProfile || user.linkedinProfile) {
      user.linkedinProfile = linkedinProfile;
    }
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: toSafeUser(user)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// -------------------------------- Change Password --------------------------------------------------------------
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hasExistingPassword = Boolean(user.password);

    if (!newPassword || !confirmNewPassword || (hasExistingPassword && !oldPassword)) {
      return res.status(400).json({
        success: false,
        message: hasExistingPassword
          ? "Please enter current password, new password, and confirm new password."
          : "Please enter new password and confirm new password.",
      });
    }

    if (hasExistingPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      if (oldPassword === newPassword) {
        return res.status(401).json({
          success: false,
          message: "Current password and new password cannot be the same.",
        });
      }
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(401).json({
        success: false,
        message: "New password and confirm new password do not match.",
      });
    }

    user.password = newPassword;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: toSafeUser(user)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// -------------------------------- Delete Account --------------------------------------------------------------
export const deleteAccount = async (req, res) => {
  try {

    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    });


  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}
