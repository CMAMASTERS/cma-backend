// middleware/auth.js
// Protects routes — checks JWT token and device session validity

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not logged in. Please login first." });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, error: "Session expired. Please login again." });
    }

    // Find user in database
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found. Please login again." });
    }

    // Check if user is still active
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: "Your account has been deactivated. Contact your teacher." });
    }

    // Check if this device session still exists (wasn't logged out or reset)
    const session = user.activeSessions.find((s) => s.token === token);
    if (!session) {
      return res.status(401).json({ success: false, error: "Session not found. Please login again." });
    }

    // Update last active time for this device
    session.lastActive = new Date();
    await user.save();

    // Attach user info to request
    req.user = user;
    req.deviceId = session.deviceId;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(500).json({ success: false, error: "Authentication error." });
  }
};

// Admin-only middleware (use after protect)
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required." });
  }
  next();
};

module.exports = { protect, adminOnly };
