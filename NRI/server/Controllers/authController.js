import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { generateToken } from "../Utils/generateToken.js";
import User from "../Models/userModel.js";

const PROFILE_LANGUAGES = new Set(["english", "hindi", "tamil", "indonesian"]);

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const isValidHttpUrl = (value) => {
  if (!value) return true;
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

const toSafeUser = (userDoc) => {
  if (!userDoc) return null;
  const user = typeof userDoc.toObject === "function" ? userDoc.toObject() : userDoc;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || "",
    phone: user.phone || "",
    countryOfResidence: user.countryOfResidence || "",
    preferredLanguage: user.preferredLanguage || "english",
    bio: user.bio || "",
    provider: user.provider || "local",
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

    const { sub, email, name, picture } = payload;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new Google user
      user = await User.create({
        name,
        email,
        googleId: sub,
        profileImage: picture,
        provider: "google",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      user: toSafeUser(user),
      token,
    });

  } catch (error) {
    console.error("Google login error:", error);
    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};


// -------------------------------- Register --------------------------------------------------------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(404).json({
        success: false,
        message: "Please enter all required fields: Name, Email and Password"
      });
    };

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(404).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    if (password !== confirmPassword) {
      return res.status(404).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const newUser = new User({ name, email, password });
    await newUser.save();

    const token = generateToken(newUser._id);
    return res.status(200).json({
      success: true,
      message: 'User registered successfully.Please sign in to continue',
      data: toSafeUser(newUser),
      token
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

// -------------------------------- Login --------------------------------------------------------------
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(404).json({
        success: false,
        message: "Please enter Email and Password"
      });
    };

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email"
      });
    }

    // User signed up with Google has no password
    if (!user.password || user.provider === "google") {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Please use the Google button to log in."
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(404).json({
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
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

// -------------------------------- Get Profile --------------------------------------------------------------
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
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

    if (!isValidHttpUrl(profileImage)) {
      return res.status(400).json({
        success: false,
        message: "Profile image must be a valid http/https URL.",
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
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Please enter Old, new Password and confirm New Password",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password did not match",
      });
    }

    if (oldPassword === newPassword) {
      return res.status(401).json({
        success: false,
        message: "Old password and New password cannot be same",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(401).json({
        success: false,
        message: "Password and confirm Password did'nt match",
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
