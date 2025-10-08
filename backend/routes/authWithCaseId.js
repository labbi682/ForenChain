const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const UserWithCaseAccess = require('../models/UserWithCaseAccess');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');

// Rate limiting store (in production, use Redis)
const loginAttempts = new Map();

// Helper function to check rate limiting
const checkRateLimit = (identifier) => {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier) || [];
    
    // Remove attempts older than 15 minutes
    const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
    
    if (recentAttempts.length >= 10) {
        return { allowed: false, message: 'Too many login attempts. Please try again later.' };
    }
    
    recentAttempts.push(now);
    loginAttempts.set(identifier, recentAttempts);
    
    return { allowed: true };
};

// Helper function to send OTP (mock implementation)
const sendOTP = async (user, otp) => {
    // In production, integrate with SMS/Email service
    console.log(`📱 OTP for ${user.username}: ${otp}`);
    console.log(`📧 Email: ${user.email}, Phone: ${user.phone}`);
    
    // TODO: Integrate with Twilio for SMS or SendGrid for Email
    return true;
};

// Helper function to log action
const logAction = async (userId, action, details, caseId = null) => {
    try {
        await AuditLog.create({
            userId,
            action,
            details,
            caseId,
            timestamp: new Date(),
            ipAddress: details.ipAddress || 'unknown'
        });
    } catch (error) {
        console.error('Error logging action:', error);
    }
};

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with KYC
 * @access  Public (but requires admin approval)
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, phone, password, role, kycDocuments } = req.body;
        
        // Validate input
        if (!username || !email || !phone || !password || !role) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        // Check if user already exists
        const existingUser = await UserWithCaseAccess.findOne({ 
            $or: [{ username }, { email }, { phone }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists with this username, email, or phone' 
            });
        }
        
        // Create new user
        const user = new UserWithCaseAccess({
            username,
            email,
            phone,
            password,
            role,
            kyc: {
                isVerified: false,
                verificationMethod: 'pending',
                documentType: kycDocuments?.type,
                documentNumber: kycDocuments?.number
            },
            isActive: false // Requires admin activation
        });
        
        await user.save();
        
        // Log registration
        await logAction(user._id, 'user_registration', {
            username,
            role,
            ipAddress: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Registration successful. Awaiting admin approval and KYC verification.',
            userId: user._id
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

/**
 * @route   POST /api/auth/login-step1
 * @desc    Step 1: Validate username, password, and Case ID
 * @access  Public
 */
router.post('/login-step1', async (req, res) => {
    try {
        const { username, password, caseId } = req.body;
        const ipAddress = req.ip;
        
        // Validate input
        if (!username || !password || !caseId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password, and Case ID are required' 
            });
        }
        
        // Check rate limiting
        const rateLimitCheck = checkRateLimit(ipAddress);
        if (!rateLimitCheck.allowed) {
            return res.status(429).json({ 
                success: false, 
                message: rateLimitCheck.message 
            });
        }
        
        // Find user
        const user = await UserWithCaseAccess.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Check if account is locked
        if (user.isLocked()) {
            const lockTimeRemaining = Math.ceil((user.loginAttempts.lockedUntil - new Date()) / 60000);
            return res.status(423).json({ 
                success: false, 
                message: `Account locked. Try again in ${lockTimeRemaining} minutes.` 
            });
        }
        
        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is not active. Please contact administrator.' 
            });
        }
        
        // Check KYC verification
        if (!user.kyc.isVerified) {
            return res.status(403).json({ 
                success: false, 
                message: 'KYC verification pending. Please complete KYC verification.' 
            });
        }
        
        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            await user.incrementLoginAttempts();
            
            // Log failed attempt
            await logAction(user._id, 'login_failed', {
                reason: 'invalid_password',
                ipAddress,
                caseId
            });
            
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Verify Case ID exists
        const caseExists = await Case.findOne({ caseId, isActive: true });
        
        if (!caseExists) {
            await user.incrementLoginAttempts();
            
            // Log failed attempt
            await logAction(user._id, 'login_failed', {
                reason: 'invalid_case_id',
                ipAddress,
                caseId
            });
            
            return res.status(404).json({ 
                success: false, 
                message: 'Case ID not found or inactive' 
            });
        }
        
        // Check if user has access to this case
        if (!user.hasAccessToCase(caseId)) {
            await user.incrementLoginAttempts();
            
            // Log unauthorized access attempt
            await logAction(user._id, 'unauthorized_case_access', {
                caseId,
                ipAddress,
                userRole: user.role
            });
            
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have access to this case' 
            });
        }
        
        // Generate and send OTP
        const otp = user.generateOTP();
        await user.save();
        
        await sendOTP(user, otp);
        
        // Log successful step 1
        await logAction(user._id, 'login_step1_success', {
            caseId,
            ipAddress
        }, caseId);
        
        res.json({
            success: true,
            message: 'OTP sent to your registered phone/email',
            userId: user._id,
            otpMethod: user.twoFactorAuth.method,
            requiresOTP: true
        });
        
    } catch (error) {
        console.error('Login Step 1 error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

/**
 * @route   POST /api/auth/login-step2
 * @desc    Step 2: Verify OTP and complete login
 * @access  Public
 */
router.post('/login-step2', async (req, res) => {
    try {
        const { userId, otp, caseId } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');
        
        // Validate input
        if (!userId || !otp || !caseId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID, OTP, and Case ID are required' 
            });
        }
        
        // Find user
        const user = await UserWithCaseAccess.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Verify OTP
        const otpVerification = user.verifyOTP(otp);
        
        if (!otpVerification.success) {
            // Log failed OTP attempt
            await logAction(user._id, 'otp_verification_failed', {
                reason: otpVerification.message,
                ipAddress,
                caseId
            }, caseId);
            
            await user.save();
            
            return res.status(401).json({ 
                success: false, 
                message: otpVerification.message 
            });
        }
        
        // Reset login attempts on successful login
        await user.resetLoginAttempts();
        
        // Create session
        const sessionToken = user.createSession(caseId, ipAddress, userAgent);
        
        // Update last login
        user.lastLogin = {
            caseId,
            timestamp: new Date(),
            ipAddress
        };
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                role: user.role,
                caseId: caseId
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '8h' }
        );
        
        // Log successful login
        await logAction(user._id, 'login_success', {
            caseId,
            ipAddress,
            userAgent
        }, caseId);
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            sessionToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                caseId: caseId,
                caseAccessLevel: user.getCaseAccessLevel(caseId)
            }
        });
        
    } catch (error) {
        console.error('Login Step 2 error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during OTP verification' 
        });
    }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const user = await UserWithCaseAccess.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Check if last OTP was sent recently (prevent spam)
        if (user.otp && user.otp.lastSentAt) {
            const timeSinceLastOTP = Date.now() - user.otp.lastSentAt.getTime();
            if (timeSinceLastOTP < 60000) { // 1 minute
                return res.status(429).json({ 
                    success: false, 
                    message: 'Please wait before requesting another OTP' 
                });
            }
        }
        
        // Generate and send new OTP
        const otp = user.generateOTP();
        await user.save();
        
        await sendOTP(user, otp);
        
        res.json({
            success: true,
            message: 'OTP resent successfully'
        });
        
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate session
 * @access  Private
 */
router.post('/logout', async (req, res) => {
    try {
        const { userId, sessionToken } = req.body;
        
        const user = await UserWithCaseAccess.findById(userId);
        
        if (user && sessionToken) {
            await user.invalidateSession(sessionToken);
            
            // Log logout
            await logAction(user._id, 'logout', {
                ipAddress: req.ip
            });
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during logout' 
        });
    }
});

/**
 * @route   GET /api/auth/verify-session
 * @desc    Verify if session is valid
 * @access  Private
 */
router.get('/verify-session', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = await UserWithCaseAccess.findById(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid session' 
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                caseId: decoded.caseId
            }
        });
        
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
});

module.exports = router;
