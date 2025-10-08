const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userWithCaseAccessSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    role: {
        type: String,
        enum: ['citizen', 'police', 'forensic', 'court', 'admin'],
        required: true
    },
    
    // Case Access Control
    associatedCaseIds: [{
        caseId: {
            type: String,
            required: true
        },
        caseRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Case'
        },
        accessLevel: {
            type: String,
            enum: ['read', 'write', 'admin'],
            default: 'read'
        },
        assignedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // KYC Information
    kyc: {
        isVerified: {
            type: Boolean,
            default: false
        },
        verificationMethod: {
            type: String,
            enum: ['government_id', 'biometric', 'manual', 'pending'],
            default: 'pending'
        },
        documentType: String,
        documentNumber: String,
        documentImages: [String],
        biometricData: String,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verifiedAt: Date,
        expiryDate: Date
    },
    
    // Two-Factor Authentication
    twoFactorAuth: {
        enabled: {
            type: Boolean,
            default: false
        },
        secret: String,
        backupCodes: [String],
        method: {
            type: String,
            enum: ['sms', 'email', 'authenticator'],
            default: 'sms'
        }
    },
    
    // OTP Management
    otp: {
        code: String,
        expiresAt: Date,
        attempts: {
            type: Number,
            default: 0
        },
        lastSentAt: Date
    },
    
    // Security
    loginAttempts: {
        count: {
            type: Number,
            default: 0
        },
        lastAttempt: Date,
        lockedUntil: Date
    },
    
    // Session Management
    sessions: [{
        token: String,
        caseId: String,
        ipAddress: String,
        userAgent: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: Date,
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Profile Information
    profile: {
        firstName: String,
        lastName: String,
        department: String,
        badgeNumber: String,
        jurisdiction: String,
        organization: String
    },
    
    // Blockchain Integration
    blockchainAddress: String,
    publicKey: String,
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        caseId: String,
        timestamp: Date,
        ipAddress: String
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Indexes for performance
userWithCaseAccessSchema.index({ username: 1, email: 1 });
userWithCaseAccessSchema.index({ 'associatedCaseIds.caseId': 1 });
userWithCaseAccessSchema.index({ 'kyc.isVerified': 1 });
userWithCaseAccessSchema.index({ role: 1, isActive: 1 });

// Hash password before saving
userWithCaseAccessSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userWithCaseAccessSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has access to a specific case
userWithCaseAccessSchema.methods.hasAccessToCase = function(caseId) {
    // Admin has access to all cases
    if (this.role === 'admin') {
        return true;
    }
    
    // Check if case is in user's associated cases
    return this.associatedCaseIds.some(
        caseAccess => caseAccess.caseId === caseId
    );
};

// Get case access level
userWithCaseAccessSchema.methods.getCaseAccessLevel = function(caseId) {
    if (this.role === 'admin') {
        return 'admin';
    }
    
    const caseAccess = this.associatedCaseIds.find(
        access => access.caseId === caseId
    );
    
    return caseAccess ? caseAccess.accessLevel : null;
};

// Generate OTP
userWithCaseAccessSchema.methods.generateOTP = function() {
    const otp = crypto.randomInt(100000, 999999).toString();
    this.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        lastSentAt: new Date()
    };
    return otp;
};

// Verify OTP
userWithCaseAccessSchema.methods.verifyOTP = function(code) {
    if (!this.otp || !this.otp.code) {
        return { success: false, message: 'No OTP generated' };
    }
    
    if (this.otp.expiresAt < new Date()) {
        return { success: false, message: 'OTP expired' };
    }
    
    if (this.otp.attempts >= 3) {
        return { success: false, message: 'Too many attempts' };
    }
    
    this.otp.attempts += 1;
    
    if (this.otp.code === code) {
        this.otp = undefined; // Clear OTP after successful verification
        return { success: true, message: 'OTP verified' };
    }
    
    return { success: false, message: 'Invalid OTP' };
};

// Check if account is locked
userWithCaseAccessSchema.methods.isLocked = function() {
    return this.loginAttempts.lockedUntil && this.loginAttempts.lockedUntil > new Date();
};

// Increment login attempts
userWithCaseAccessSchema.methods.incrementLoginAttempts = function() {
    this.loginAttempts.count += 1;
    this.loginAttempts.lastAttempt = new Date();
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts.count >= 5) {
        this.loginAttempts.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    
    return this.save();
};

// Reset login attempts
userWithCaseAccessSchema.methods.resetLoginAttempts = function() {
    this.loginAttempts = {
        count: 0,
        lastAttempt: null,
        lockedUntil: null
    };
    return this.save();
};

// Create session
userWithCaseAccessSchema.methods.createSession = function(caseId, ipAddress, userAgent) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    
    this.sessions.push({
        token,
        caseId,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        expiresAt,
        isActive: true
    });
    
    // Keep only last 5 sessions
    if (this.sessions.length > 5) {
        this.sessions = this.sessions.slice(-5);
    }
    
    return token;
};

// Invalidate session
userWithCaseAccessSchema.methods.invalidateSession = function(token) {
    const session = this.sessions.find(s => s.token === token);
    if (session) {
        session.isActive = false;
    }
    return this.save();
};

// Remove password and sensitive data from JSON response
userWithCaseAccessSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.otp;
    delete obj.twoFactorAuth.secret;
    delete obj.twoFactorAuth.backupCodes;
    delete obj.sessions;
    return obj;
};

module.exports = mongoose.model('UserWithCaseAccess', userWithCaseAccessSchema);
