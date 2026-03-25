// routes/auth.js — Login, logout, profile, admin setup

const express   = require("express");
const jwt       = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const UAParser  = require("ua-parser-js");
const User      = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

const generateToken = (userId, deviceId) =>
  jwt.sign({ userId, deviceId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// Detect device type and name from User-Agent
const parseDevice = (userAgent) => {
  try {
    const parser  = new UAParser(userAgent);
    const device  = parser.getDevice();
    const browser = parser.getBrowser().name || "Browser";
    const os      = parser.getOS().name || "Device";

    // Mobile types: mobile, tablet
    const isMobile =
      device.type === "mobile" ||
      device.type === "tablet" ||
      /android|iphone|ipad|ipod|mobile/i.test(userAgent);

    return {
      deviceType: isMobile ? "mobile" : "desktop",
      deviceName: `${browser} on ${os}`,
    };
  } catch {
    return { deviceType: "desktop", deviceName: "Unknown Device" };
  }
};

// ── POST /api/auth/login ───────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { userId, password, deviceId } = req.body;
    if (!userId || !password || !deviceId) {
      return res.status(400).json({ success: false, error: "User ID, password, and device ID are required." });
    }

    const user = await User.findOne({ userId: userId.trim().toUpperCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid User ID or password." });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: "Your account has been deactivated. Contact Masters Professional Academy." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid User ID or password." });
    }

    // Check if THIS exact device already has a session → just refresh token
    const existingSession = user.getSession(deviceId);
    if (existingSession) {
      const newToken = generateToken(user.userId, deviceId);
      existingSession.token      = newToken;
      existingSession.lastActive = new Date();
      user.lastLogin             = new Date();
      await user.save();
      return res.json({
        success: true, token: newToken,
        user: { userId: user.userId, name: user.name, role: user.role, course: user.course },
      });
    }

    // New device — detect its type
    const { deviceType, deviceName } = parseDevice(req.headers["user-agent"] || "");

    // Check device-type slot (1 mobile + 1 desktop allowed)
    const slotStatus = user.canAddDeviceType(deviceType);

    if (slotStatus === "slot_taken") {
      const typeLabel = deviceType === "mobile" ? "mobile/tablet" : "laptop/desktop";
      return res.status(403).json({
        success: false,
        code: "DEVICE_LIMIT_REACHED",
        deviceType,
        error: `You are already logged in on a ${typeLabel}. Please logout from that device first, or contact your teacher to reset your session.`,
      });
    }

    // Add new session
    const token = generateToken(user.userId, deviceId);
    user.activeSessions.push({
      deviceId,
      deviceName,
      deviceType,
      ipAddress:  req.ip || "",
      loginTime:  new Date(),
      lastActive: new Date(),
      token,
    });
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true, token,
      user: { userId: user.userId, name: user.name, role: user.role, course: user.course },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, error: "Login failed. Please try again." });
  }
});

// ── POST /api/auth/logout ──────────────────────────
router.post("/logout", protect, async (req, res) => {
  try {
    req.user.removeSession(req.deviceId);
    await req.user.save();
    res.json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: "Logout failed." });
  }
});

// ── GET /api/auth/me ───────────────────────────────
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: {
      userId:        req.user.userId,
      name:          req.user.name,
      role:          req.user.role,
      course:        req.user.course,
      totalDoubts:   req.user.totalDoubts,
      activeDevices: req.user.activeSessions.length,
      lastLogin:     req.user.lastLogin,
    },
  });
});

// ── POST /api/auth/setup-admin ─────────────────────
router.post("/setup-admin", async (req, res) => {
  try {
    const { adminSecret, userId, name, password } = req.body;
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, error: "Invalid admin secret." });
    }
    const existing = await User.findOne({ userId: userId.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: "User ID already exists." });
    }
    const admin = await User.create({ userId: userId.toUpperCase(), name, password, role: "admin", course: "All" });
    res.json({ success: true, message: `Admin account created: ${admin.userId}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
