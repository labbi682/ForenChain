const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Role - Completely Isolated
  role: {
    type: String,
    enum: ['citizen', 'police', 'forensic_expert', 'court_official', 'admin'],
    required: true
  },
  
  // KYC Information
  kyc: {
    status: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'rejected'],
      default: 'pending'
    },
    fullName: { type: String, required: true },
    dateOfBirth: Date,
    nationalId: String, // Aadhaar/Passport/License
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    },
    phoneNumber: { type: String, required: true },
    documents: [{
      type: { type: String }, // 'id_proof', 'address_proof', 'photo'
      url: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    rejectionReason: String
  },
  
  // Role-Specific Information
  roleDetails: {
    // For Police
    badgeNumber: String,
    department: String,
    rank: String,
    stationCode: String,
    
    // For Forensic Expert
    licenseNumber: String,
    specialization: String,
    certifications: [String],
    
    // For Court Official
    courtId: String,
    designation: String,
    jurisdiction: String,
    
    // For Citizen
    occupation: String
  },
  
  // Two-Factor Authentication
  twoFactorAuth: {
    enabled: { type: Boolean, default: true },
    secret: String,
    backupCodes: [String],
    lastOtpSentAt: Date,
    otpAttempts: { type: Number, default: 0 }
  },
  
  // Encryption Keys (for file access)
  encryptionKey: {
    publicKey: String,
    privateKeyEncrypted: String, // Encrypted with user password
    keyVersion: { type: Number, default: 1 }
  },
  
  // Security
  isActive: {
    type: Boolean,
    default: false // Activated only after KYC verification
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: String,
  
  // Session Management
  sessions: [{
    sessionId: String,
    deviceInfo: String,
    ipAddress: String,
    loginAt: Date,
    lastActivityAt: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true }
  }],
  
  // Login History
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    deviceInfo: String,
    location: String,
    success: Boolean,
    failureReason: String
  }],
  
  // Security Alerts
  securityAlerts: [{
    type: String, // 'unauthorized_access', 'suspicious_activity', 'password_change'
    message: String,
    timestamp: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],
  
  // Permissions (granular control)
  permissions: {
    canUpload: { type: Boolean, default: false },
    canView: { type: Boolean, default: false },
    canVerify: { type: Boolean, default: false },
    canTransfer: { type: Boolean, default: false },
    canApprove: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false }
  },
  
  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Account Status
  lastLogin: Date,
  lastPasswordChange: Date,
  accountCreatedAt: { type: Date, default: Date.now },
  
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function() {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.twoFactorAuth.lastOtpSentAt = new Date();
  return otp;
};

// Verify OTP (6-digit, valid for 5 minutes)
userSchema.methods.verifyOTP = function(otp, storedOtp, sentAt) {
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (now - sentAt > fiveMinutes) {
    return { valid: false, reason: 'OTP expired' };
  }
  
  if (this.twoFactorAuth.otpAttempts >= 3) {
    return { valid: false, reason: 'Too many attempts' };
  }
  
  if (otp === storedOtp) {
    this.twoFactorAuth.otpAttempts = 0;
    return { valid: true };
  }
  
  this.twoFactorAuth.otpAttempts += 1;
  return { valid: false, reason: 'Invalid OTP' };
};

// Create session
userSchema.methods.createSession = function(deviceInfo, ipAddress) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  
  this.sessions.push({
    sessionId,
    deviceInfo,
    ipAddress,
    loginAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt,
    isActive: true
  });
  
  return sessionId;
};

// Update session activity
userSchema.methods.updateSessionActivity = function(sessionId) {
  const session = this.sessions.find(s => s.sessionId === sessionId && s.isActive);
  if (session) {
    session.lastActivityAt = new Date();
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Extend 30 minutes
  }
};

// Invalidate session
userSchema.methods.invalidateSession = function(sessionId) {
  const session = this.sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.isActive = false;
  }
};

// Check if session is valid
userSchema.methods.isSessionValid = function(sessionId) {
  const session = this.sessions.find(s => s.sessionId === sessionId && s.isActive);
  if (!session) return false;
  
  const now = new Date();
  if (now > session.expiresAt) {
    session.isActive = false;
    return false;
  }
  
  return true;
};

// Add security alert
userSchema.methods.addSecurityAlert = function(type, message) {
  this.securityAlerts.push({ type, message });
  
  // Keep only last 50 alerts
  if (this.securityAlerts.length > 50) {
    this.securityAlerts = this.securityAlerts.slice(-50);
  }
};

// Set role-based permissions
userSchema.methods.setRolePermissions = function() {
  switch(this.role) {
    case 'citizen':
      this.permissions = {
        canUpload: true,
        canView: true, // Only own files
        canVerify: false,
        canTransfer: false,
        canApprove: false,
        canDelete: false,
        canManageUsers: false
      };
      break;
      
    case 'police':
      this.permissions = {
        canUpload: false,
        canView: true, // All evidence
        canVerify: true,
        canTransfer: true,
        canApprove: false,
        canDelete: false,
        canManageUsers: false
      };
      break;
      
    case 'forensic_expert':
      this.permissions = {
        canUpload: false,
        canView: true, // Assigned cases only
        canVerify: true,
        canTransfer: false,
        canApprove: false,
        canDelete: false,
        canManageUsers: false
      };
      break;
      
    case 'court_official':
      this.permissions = {
        canUpload: false,
        canView: true, // Verified evidence only
        canVerify: false,
        canTransfer: false,
        canApprove: false,
        canDelete: false,
        canManageUsers: false
      };
      break;
      
    case 'admin':
      this.permissions = {
        canUpload: false,
        canView: true,
        canVerify: false,
        canTransfer: false,
        canApprove: true,
        canDelete: true,
        canManageUsers: true
      };
      break;
  }
};

// Remove sensitive data from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorAuth.secret;
  delete obj.encryptionKey.privateKeyEncrypted;
  delete obj.passwordResetToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
