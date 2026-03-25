// models/User.js
// MongoDB schema for students and admins
// Device limit: max 1 mobile + 1 desktop/laptop per student

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const DeviceSessionSchema = new mongoose.Schema({
  deviceId:   { type: String, required: true },
  deviceName: { type: String, default: "Unknown" },
  deviceType: { type: String, enum: ["mobile", "desktop"], required: true },
  ipAddress:  { type: String, default: "" },
  loginTime:  { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  token:      { type: String, required: true },
});

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String, required: [true, "User ID is required"],
      unique: true, trim: true, uppercase: true,
    },
    name:     { type: String, required: [true, "Name is required"], trim: true },
    password: { type: String, required: [true, "Password is required"], minlength: 6, select: false },
    role:     { type: String, enum: ["student", "admin"], default: "student" },
    course:   { type: String, enum: ["Foundation", "Inter", "Final", "All"], default: "Inter" },
    isActive: { type: Boolean, default: true },
    activeSessions: { type: [DeviceSessionSchema], default: [] },
    totalDoubts:    { type: Number, default: 0 },
    lastLogin:      { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

// Returns "available" | "slot_taken" | "admin_ok"
UserSchema.methods.canAddDeviceType = function (deviceType) {
  if (this.role === "admin") return "admin_ok";
  const existing = this.activeSessions.find((s) => s.deviceType === deviceType);
  return existing ? "slot_taken" : "available";
};

UserSchema.methods.getSession         = function (deviceId)   { return this.activeSessions.find((s) => s.deviceId   === deviceId); };
UserSchema.methods.getSessionByType   = function (deviceType) { return this.activeSessions.find((s) => s.deviceType === deviceType); };
UserSchema.methods.removeSession      = function (deviceId)   { this.activeSessions = this.activeSessions.filter((s) => s.deviceId   !== deviceId); };
UserSchema.methods.removeSessionByType = function (deviceType){ this.activeSessions = this.activeSessions.filter((s) => s.deviceType !== deviceType); };

module.exports = mongoose.model("User", UserSchema);
