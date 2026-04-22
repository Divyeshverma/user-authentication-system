const crypto = require("crypto");
const path = require("path");

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-before-deploying";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pinCode: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    otpHash: String,
    otpExpiresAt: Date,
    resetOtpHash: String,
    resetOtpExpiresAt: Date,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

function hashValue(value, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(value, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function isValidHash(value, salt, expectedHash) {
  const { hash } = hashValue(value, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

function createOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;

  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < Date.now()) return null;
  return payload;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return res.status(401).json({ message: "Please login again." });
  }

  req.userId = payload.userId;
  next();
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    gender: user.gender,
    state: user.state,
    pinCode: user.pinCode,
    isVerified: user.isVerified,
    registeredAt: user.createdAt,
  };
}

async function sendOtp(email, otp, purpose) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log(`[${purpose}] OTP for ${email}: ${otp}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"User Auth System" <${EMAIL_USER}>`,
    to: email,
    subject: `${purpose} OTP`,
    text: `Your ${purpose.toLowerCase()} OTP is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${purpose} OTP</h2>
        <p>Your OTP is:</p>
        <p style="font-size: 26px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This OTP will expire in 10 minutes.</p>
      </div>
    `,
  });

  console.log(`[${purpose}] OTP email sent to ${email}`);
}

function validateRequired(body, fields) {
  return fields.filter((field) => !String(body[field] || "").trim());
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/register", async (req, res) => {
  try {
    const missing = validateRequired(req.body, ["name", "email", "password", "mobile", "gender", "state", "pinCode"]);
    if (missing.length) {
      return res.status(400).json({ message: `Missing fields: ${missing.join(", ")}` });
    }

    const email = req.body.email.toLowerCase().trim();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const password = hashValue(req.body.password);
    const otp = createOtp();
    const otpHash = hashValue(otp);

    await User.create({
      name: req.body.name,
      email,
      mobile: req.body.mobile,
      gender: req.body.gender,
      state: req.body.state,
      pinCode: req.body.pinCode,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      otpHash: `${otpHash.salt}:${otpHash.hash}`,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOtp(email, otp, "Email verification");
    res.status(201).json({ message: "Registration successful. Check your email for the OTP." });
  } catch (error) {
    res.status(500).json({ message: "Registration failed.", error: error.message });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "Invalid verification request." });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired. Register again or request a new OTP." });
    }

    const [salt, hash] = user.otpHash.split(":");
    if (!isValidHash(String(otp || ""), salt, hash)) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.json({ message: "Email verified. You can login now." });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed.", error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });

    if (!user || !isValidHash(String(password || ""), user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email OTP before login." });
    }

    const token = signToken({ userId: user._id.toString() });
    res.json({ message: "Login successful.", token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

app.get("/api/profile", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ user: publicUser(user) });
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });

    if (user) {
      const otp = createOtp();
      const otpHash = hashValue(otp);
      user.resetOtpHash = `${otpHash.salt}:${otpHash.hash}`;
      user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendOtp(email, otp, "Password reset");
    }

    res.json({ message: "If this email exists, a reset OTP has been sent to the email." });
  } catch (error) {
    res.status(500).json({ message: "Could not start password reset.", error: error.message });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "Invalid reset request." });
    }

    if (user.resetOtpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Reset OTP expired." });
    }

    const [salt, hash] = user.resetOtpHash.split(":");
    if (!isValidHash(String(otp || ""), salt, hash)) {
      return res.status(400).json({ message: "Invalid reset OTP." });
    }

    const password = hashValue(newPassword);
    user.passwordHash = password.hash;
    user.passwordSalt = password.salt;
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    res.json({ message: "Password reset successful. Login with your new password." });
  } catch (error) {
    res.status(500).json({ message: "Password reset failed.", error: error.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it in .env or deployment environment variables.");
  }

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
