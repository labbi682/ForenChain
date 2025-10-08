const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/UserEnhanced');
const AuditLog = require('../models/AuditLog');
const { sendOTP, sendSecurityAlert } = require('../services/notifications');

const JWT_SECRET = process.env.JWT_SECRET || 'forenchain_secret_key_2024';
const JWT_EXPIRES_IN = '30m'; // Short-lived tokens

// Temporary OTP storage (use Redis in production)
const otpStore = new Map();

/**
 * STEP 1: Register with KYC
 */
router.post('/register', async (req, res) => {
  try {
    const {
      username, email, password, role,
      fullName, dateOfBirth, nationalId, phoneNumber,
      address, roleDetails
    } = req.body;

    // Validate required fields
    if (!username || !email || !password || !role || !fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    const validRoles = ['citizen', 'police', 'forensic_expert', 'court_official'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Generate encryption keys
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Encrypt private key with password (simplified - use proper key derivation in production)
    const cipher = crypto.createCipher('aes-256-cbc', password);
    let privateKeyEncrypted = cipher.update(privateKey, 'utf8', 'hex');
    privateKeyEncrypted += cipher.final('hex');

    // Create user
    const user = new User({
      username,
      email,
      password,
      role,
      kyc: {
        status: 'submitted',
        fullName,
        dateOfBirth,
        nationalId,
        phoneNumber,
        address
      },
      roleDetails,
      encryptionKey: {
        publicKey,
        privateKeyEncrypted
      },
      isActive: false // Activated after KYC verification
    });

    // Set role-based permissions
    user.setRolePermissions();

    await user.save();

    // Log registration
    await AuditLog.create({
      action: 'register',
      performedBy: user._id,
      details: `New ${role} account registered - pending KYC verification`,
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Registration successful. Your account is pending KYC verification.',
      userId: user._id,
      kycStatus: user.kyc.status
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

/**
 * STEP 2: Login (First Factor - Password)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, portal } = req.body;

    if (!username || !password || !portal) {
      return res.status(400).json({ error: 'Username, password, and portal are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ 
        error: 'Account blocked', 
        reason: user.blockReason 
      });
    }

    // Verify portal matches role
    const portalRoleMap = {
      'citizen': 'citizen',
      'police': 'police',
      'forensic': 'forensic_expert',
      'court': 'court_official',
      'admin': 'admin'
    };

    if (portalRoleMap[portal] !== user.role) {
      // Log unauthorized portal access attempt
      user.loginHistory.push({
        timestamp: new Date(),
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        success: false,
        failureReason: 'Wrong portal access'
      });
      await user.save();

      user.addSecurityAlert('unauthorized_access', `Attempted to access ${portal} portal`);
      await user.save();

      return res.status(403).json({ 
        error: 'Access denied. Please use the correct portal for your role.' 
      });
    }

    // Check KYC status
    if (user.kyc.status !== 'verified') {
      return res.status(403).json({ 
        error: 'Account not activated', 
        kycStatus: user.kyc.status,
        message: 'Your KYC verification is pending. Please contact admin.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginHistory.push({
        timestamp: new Date(),
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        success: false,
        failureReason: 'Invalid password'
      });
      await user.save();

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate OTP
    const otp = user.generateOTP();
    const otpToken = crypto.randomBytes(32).toString('hex');
    
    // Store OTP temporarily
    otpStore.set(otpToken, {
      userId: user._id.toString(),
      otp,
      sentAt: new Date(),
      attempts: 0
    });

    // Send OTP (via SMS/Email)
    await sendOTP(user.kyc.phoneNumber, user.email, otp);

    // Save OTP sent time
    await user.save();

    res.json({
      message: 'OTP sent to your registered phone and email',
      otpToken,
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

/**
 * STEP 3: Verify OTP (Second Factor)
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { otpToken, otp } = req.body;

    if (!otpToken || !otp) {
      return res.status(400).json({ error: 'OTP token and OTP are required' });
    }

    // Get stored OTP
    const otpData = otpStore.get(otpToken);
    if (!otpData) {
      return res.status(400).json({ error: 'Invalid or expired OTP token' });
    }

    // Find user
    const user = await User.findById(otpData.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    const verification = user.verifyOTP(otp, otpData.otp, otpData.sentAt);
    
    if (!verification.valid) {
      otpData.attempts += 1;
      
      if (otpData.attempts >= 3) {
        otpStore.delete(otpToken);
        user.addSecurityAlert('failed_otp', 'Multiple failed OTP attempts');
        await user.save();
      }
      
      return res.status(400).json({ error: verification.reason });
    }

    // OTP verified - create session
    const sessionId = user.createSession(
      req.headers['user-agent'],
      req.ip
    );

    // Generate JWT with session
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role,
        sessionId 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Update login history
    user.loginHistory.push({
      timestamp: new Date(),
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
      success: true
    });
    user.lastLogin = new Date();

    await user.save();

    // Clean up OTP
    otpStore.delete(otpToken);

    // Log successful login
    await AuditLog.create({
      action: 'login',
      performedBy: user._id,
      details: 'Successful login with 2FA',
      ipAddress: req.ip
    });

    res.json({
      message: 'Login successful',
      token,
      sessionId,
      user: user.toJSON(),
      expiresIn: '30 minutes'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

/**
 * Middleware: Authenticate and validate session
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Find user and validate session
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Account blocked' });
      }

      // Validate session
      if (!user.isSessionValid(decoded.sessionId)) {
        return res.status(401).json({ 
          error: 'Session expired or invalid',
          code: 'SESSION_EXPIRED'
        });
      }

      // Update session activity
      user.updateSessionActivity(decoded.sessionId);
      await user.save();

      req.user = decoded;
      req.userDoc = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

/**
 * Middleware: Check role permission
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      req.userDoc.addSecurityAlert(
        'unauthorized_access',
        `Attempted to access ${req.path} without permission`
      );
      req.userDoc.save();

      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this resource'
      });
    }
    next();
  };
}

/**
 * Logout
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const user = req.userDoc;
    
    // Invalidate session
    user.invalidateSession(req.user.sessionId);
    await user.save();

    // Log logout
    await AuditLog.create({
      action: 'logout',
      performedBy: user._id,
      details: 'User logged out',
      ipAddress: req.ip
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Get current user profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Get security alerts
 */
router.get('/security-alerts', authenticateToken, async (req, res) => {
  try {
    const user = req.userDoc;
    const unacknowledged = user.securityAlerts.filter(alert => !alert.acknowledged);
    
    res.json({ 
      alerts: user.securityAlerts,
      unacknowledgedCount: unacknowledged.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * Acknowledge security alert
 */
router.post('/security-alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const user = req.userDoc;
    const alert = user.securityAlerts.id(req.params.alertId);
    
    if (alert) {
      alert.acknowledged = true;
      await user.save();
    }
    
    res.json({ message: 'Alert acknowledged' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireRole = requireRole;
