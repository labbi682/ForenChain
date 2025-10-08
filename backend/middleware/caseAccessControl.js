const UserWithCaseAccess = require('../models/UserWithCaseAccess');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token and authenticate user
 */
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required. No token provided.' 
            });
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user
        const user = await UserWithCaseAccess.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is inactive. Contact administrator.' 
            });
        }
        
        // Check KYC verification
        if (!user.kyc.isVerified) {
            return res.status(403).json({ 
                success: false, 
                message: 'KYC verification required' 
            });
        }
        
        // Attach user and case info to request
        req.user = user;
        req.currentCaseId = decoded.caseId;
        req.userId = user._id;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Session expired. Please login again.' 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid authentication token' 
        });
    }
};

/**
 * Middleware to check if user has access to a specific case
 */
const verifyCaseAccess = (paramName = 'caseId') => {
    return async (req, res, next) => {
        try {
            // Get case ID from params, body, or query
            const caseId = req.params[paramName] || req.body[paramName] || req.query[paramName];
            
            if (!caseId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Case ID is required' 
                });
            }
            
            // Check if case exists
            const caseDoc = await Case.findOne({ caseId, isActive: true });
            
            if (!caseDoc) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Case not found or inactive' 
                });
            }
            
            // Check if user has access to this case
            if (!req.user.hasAccessToCase(caseId)) {
                // Log unauthorized access attempt
                await AuditLog.create({
                    userId: req.user._id,
                    action: 'unauthorized_case_access_attempt',
                    details: {
                        caseId,
                        userRole: req.user.role,
                        requestPath: req.path,
                        ipAddress: req.ip
                    },
                    caseId,
                    timestamp: new Date()
                });
                
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied. You do not have permission to access this case.' 
                });
            }
            
            // Attach case to request
            req.case = caseDoc;
            req.caseId = caseId;
            
            next();
        } catch (error) {
            console.error('Case access verification error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error verifying case access' 
            });
        }
    };
};

/**
 * Middleware to check user role
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            // Log unauthorized role access attempt
            AuditLog.create({
                userId: req.user._id,
                action: 'unauthorized_role_access',
                details: {
                    userRole: req.user.role,
                    requiredRoles: allowedRoles,
                    requestPath: req.path,
                    ipAddress: req.ip
                },
                timestamp: new Date()
            }).catch(err => console.error('Error logging unauthorized access:', err));
            
            return res.status(403).json({ 
                success: false, 
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
            });
        }
        
        next();
    };
};

/**
 * Middleware to check case access level (read, write, admin)
 */
const requireCaseAccessLevel = (requiredLevel) => {
    const accessLevels = { 'read': 1, 'write': 2, 'admin': 3 };
    
    return (req, res, next) => {
        const caseId = req.caseId || req.params.caseId || req.body.caseId;
        
        if (!caseId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Case ID is required' 
            });
        }
        
        // Admin always has full access
        if (req.user.role === 'admin') {
            return next();
        }
        
        const userAccessLevel = req.user.getCaseAccessLevel(caseId);
        
        if (!userAccessLevel) {
            return res.status(403).json({ 
                success: false, 
                message: 'No access to this case' 
            });
        }
        
        if (accessLevels[userAccessLevel] < accessLevels[requiredLevel]) {
            return res.status(403).json({ 
                success: false, 
                message: `Insufficient permissions. Required: ${requiredLevel} access` 
            });
        }
        
        next();
    };
};

/**
 * Middleware to log all actions
 */
const logAction = (action) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;
        
        // Override send function to log after response
        res.send = function(data) {
            // Log the action
            AuditLog.create({
                userId: req.user?._id,
                action,
                details: {
                    method: req.method,
                    path: req.path,
                    params: req.params,
                    query: req.query,
                    body: req.body,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                    statusCode: res.statusCode
                },
                caseId: req.caseId || req.currentCaseId,
                timestamp: new Date()
            }).catch(err => console.error('Error logging action:', err));
            
            // Call original send
            originalSend.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware to check session validity
 */
const validateSession = async (req, res, next) => {
    try {
        const sessionToken = req.headers['x-session-token'];
        
        if (!sessionToken) {
            return res.status(401).json({ 
                success: false, 
                message: 'Session token required' 
            });
        }
        
        // Find active session
        const user = req.user;
        const session = user.sessions.find(
            s => s.token === sessionToken && s.isActive
        );
        
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired session' 
            });
        }
        
        // Check if session expired
        if (session.expiresAt < new Date()) {
            session.isActive = false;
            await user.save();
            
            return res.status(401).json({ 
                success: false, 
                message: 'Session expired. Please login again.' 
            });
        }
        
        // Attach session to request
        req.session = session;
        
        next();
    } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error validating session' 
        });
    }
};

/**
 * Middleware for rate limiting
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const identifier = req.user?._id?.toString() || req.ip;
        const now = Date.now();
        
        if (!requests.has(identifier)) {
            requests.set(identifier, []);
        }
        
        const userRequests = requests.get(identifier);
        
        // Remove old requests outside the time window
        const recentRequests = userRequests.filter(
            timestamp => now - timestamp < windowMs
        );
        
        if (recentRequests.length >= maxRequests) {
            return res.status(429).json({ 
                success: false, 
                message: 'Too many requests. Please try again later.' 
            });
        }
        
        recentRequests.push(now);
        requests.set(identifier, recentRequests);
        
        next();
    };
};

module.exports = {
    authenticate,
    verifyCaseAccess,
    requireRole,
    requireCaseAccessLevel,
    logAction,
    validateSession,
    rateLimit
};
