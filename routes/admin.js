// routes/admin.js
// Admin endpoints: add/remove students, reset sessions, view all students

const express = require("express");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// All routes here require: valid JWT + admin role
router.use(protect, adminOnly);

// ── GET /api/admin/students ────────────────────────
// Get all students with their device info
router.get("/students", async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).sort({ createdAt: -1 });

    const data = students.map((s) => ({
      userId: s.userId,
      name: s.name,
      course: s.course,
      isActive: s.isActive,
      totalDoubts: s.totalDoubts,
      activeDevices: s.activeSessions.length,
      devices: s.activeSessions.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        loginTime: d.loginTime,
        lastActive: d.lastActive,
      })),
      createdAt: s.createdAt,
      lastLogin: s.lastLogin,
    }));

    res.json({ success: true, count: data.length, students: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /api/admin/students ───────────────────────
// Add a new student
router.post("/students", async (req, res) => {
  try {
    const { userId, name, password, course } = req.body;

    if (!userId || !name || !password) {
      return res.status(400).json({
        success: false,
        error: "User ID, name, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters.",
      });
    }

    const existing = await User.findOne({ userId: userId.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `User ID "${userId.toUpperCase()}" already exists.`,
      });
    }

    const student = await User.create({
      userId: userId.trim().toUpperCase(),
      name: name.trim(),
      password,
      role: "student",
      course: course || "Inter",
    });

    res.status(201).json({
      success: true,
      message: `Student ${student.userId} created successfully.`,
      student: {
        userId: student.userId,
        name: student.name,
        course: student.course,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /api/admin/students/:userId ─────────────
// Remove a student account
router.delete("/students/:userId", async (req, res) => {
  try {
    const student = await User.findOneAndDelete({
      userId: req.params.userId.toUpperCase(),
      role: "student",
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }

    res.json({
      success: true,
      message: `Student ${student.userId} removed successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PATCH /api/admin/students/:userId/toggle ───────
// Activate or deactivate a student (block without deleting)
router.patch("/students/:userId/toggle", async (req, res) => {
  try {
    const student = await User.findOne({
      userId: req.params.userId.toUpperCase(),
      role: "student",
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }

    student.isActive = !student.isActive;
    await student.save();

    res.json({
      success: true,
      message: `Student ${student.userId} is now ${student.isActive ? "active" : "deactivated"}.`,
      isActive: student.isActive,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /api/admin/students/:userId/sessions ────
// Reset ALL device sessions for a student
// (student must re-login on all devices)
router.delete("/students/:userId/sessions", async (req, res) => {
  try {
    const student = await User.findOne({
      userId: req.params.userId.toUpperCase(),
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }

    const sessionCount = student.activeSessions.length;
    student.activeSessions = [];
    await student.save();

    res.json({
      success: true,
      message: `Cleared ${sessionCount} device session(s) for ${student.userId}. They must login again.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PATCH /api/admin/students/:userId/password ─────
// Reset a student's password
router.patch("/students/:userId/password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters." });
    }

    const student = await User.findOne({
      userId: req.params.userId.toUpperCase(),
    }).select("+password");

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }

    student.password = newPassword;
    student.activeSessions = []; // Force re-login on all devices
    await student.save();

    res.json({
      success: true,
      message: `Password reset for ${student.userId}. All sessions cleared.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
