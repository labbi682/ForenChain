const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const UserWithCaseAccess = require('../models/UserWithCaseAccess');
const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

// Middleware to verify JWT and extract user
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = await UserWithCaseAccess.findById(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        
        req.user = user;
        req.currentCaseId = decoded.caseId;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// Middleware to check admin role
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

/**
 * @route   POST /api/cases/create
 * @desc    Create a new case (Admin only)
 * @access  Private (Admin)
 */
router.post('/create', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { caseName, caseNumber, description, priority, jurisdiction, category } = req.body;
        
        // Validate input
        if (!caseName || !caseNumber || !description) {
            return res.status(400).json({ 
                success: false, 
                message: 'Case name, number, and description are required' 
            });
        }
        
        // Generate unique Case ID
        const caseId = `CASE-${uuidv4()}`;
        
        // Check if case number already exists
        const existingCase = await Case.findOne({ caseNumber });
        if (existingCase) {
            return res.status(400).json({ 
                success: false, 
                message: 'Case number already exists' 
            });
        }
        
        // Create new case
        const newCase = new Case({
            caseId,
            caseName,
            caseNumber,
            description,
            status: 'active',
            createdBy: req.user._id,
            metadata: {
                jurisdiction,
                priority: priority || 'medium',
                category
            },
            isActive: true
        });
        
        await newCase.save();
        
        // Add timeline entry
        await newCase.addTimelineEntry(
            'case_created',
            req.user._id,
            `Case created by ${req.user.username}`
        );
        
        // Log action
        await AuditLog.create({
            userId: req.user._id,
            action: 'case_created',
            details: {
                caseId,
                caseName,
                caseNumber
            },
            caseId,
            timestamp: new Date()
        });
        
        res.status(201).json({
            success: true,
            message: 'Case created successfully',
            case: newCase
        });
        
    } catch (error) {
        console.error('Create case error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while creating case' 
        });
    }
});

/**
 * @route   POST /api/cases/assign-user
 * @desc    Assign user to a case (Admin only)
 * @access  Private (Admin)
 */
router.post('/assign-user', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { caseId, userId, accessLevel } = req.body;
        
        // Validate input
        if (!caseId || !userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Case ID and User ID are required' 
            });
        }
        
        // Find case
        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc) {
            return res.status(404).json({ 
                success: false, 
                message: 'Case not found' 
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
        
        // Check if user already assigned to case
        const alreadyAssigned = user.associatedCaseIds.some(
            access => access.caseId === caseId
        );
        
        if (alreadyAssigned) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already assigned to this case' 
            });
        }
        
        // Assign user to case
        user.associatedCaseIds.push({
            caseId,
            caseRef: caseDoc._id,
            accessLevel: accessLevel || 'read',
            assignedAt: new Date()
        });
        
        await user.save();
        
        // Update case with assigned user
        await caseDoc.assignUser(userId, user.role);
        
        // Add timeline entry
        await caseDoc.addTimelineEntry(
            'user_assigned',
            req.user._id,
            `User ${user.username} (${user.role}) assigned to case`
        );
        
        // Log action
        await AuditLog.create({
            userId: req.user._id,
            action: 'user_assigned_to_case',
            details: {
                caseId,
                assignedUserId: userId,
                assignedUsername: user.username,
                role: user.role,
                accessLevel: accessLevel || 'read'
            },
            caseId,
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            message: 'User assigned to case successfully'
        });
        
    } catch (error) {
        console.error('Assign user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while assigning user' 
        });
    }
});

/**
 * @route   GET /api/cases/my-cases
 * @desc    Get all cases assigned to current user
 * @access  Private
 */
router.get('/my-cases', authMiddleware, async (req, res) => {
    try {
        let cases;
        
        if (req.user.role === 'admin') {
            // Admin can see all cases
            cases = await Case.find({ isActive: true })
                .populate('createdBy', 'username email')
                .sort({ createdAt: -1 });
        } else {
            // Get user's assigned case IDs
            const caseIds = req.user.associatedCaseIds.map(access => access.caseId);
            
            // Find cases
            cases = await Case.find({ 
                caseId: { $in: caseIds },
                isActive: true 
            })
                .populate('createdBy', 'username email')
                .sort({ createdAt: -1 });
        }
        
        res.json({
            success: true,
            cases
        });
        
    } catch (error) {
        console.error('Get cases error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching cases' 
        });
    }
});

/**
 * @route   GET /api/cases/:caseId
 * @desc    Get case details
 * @access  Private
 */
router.get('/:caseId', authMiddleware, async (req, res) => {
    try {
        const { caseId } = req.params;
        
        // Check if user has access to this case
        if (!req.user.hasAccessToCase(caseId)) {
            // Log unauthorized access attempt
            await AuditLog.create({
                userId: req.user._id,
                action: 'unauthorized_case_access_attempt',
                details: {
                    caseId,
                    userRole: req.user.role
                },
                caseId,
                timestamp: new Date()
            });
            
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have access to this case' 
            });
        }
        
        // Find case
        const caseDoc = await Case.findOne({ caseId })
            .populate('createdBy', 'username email role')
            .populate('assignedUsers.userId', 'username email role');
        
        if (!caseDoc) {
            return res.status(404).json({ 
                success: false, 
                message: 'Case not found' 
            });
        }
        
        // Log case access
        await AuditLog.create({
            userId: req.user._id,
            action: 'case_viewed',
            details: {
                caseId,
                caseName: caseDoc.caseName
            },
            caseId,
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            case: caseDoc
        });
        
    } catch (error) {
        console.error('Get case error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching case' 
        });
    }
});

/**
 * @route   GET /api/cases/:caseId/users
 * @desc    Get all users assigned to a case
 * @access  Private
 */
router.get('/:caseId/users', authMiddleware, async (req, res) => {
    try {
        const { caseId } = req.params;
        
        // Check if user has access to this case
        if (!req.user.hasAccessToCase(caseId)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have access to this case' 
            });
        }
        
        // Find all users with access to this case
        const users = await UserWithCaseAccess.find({
            'associatedCaseIds.caseId': caseId,
            isActive: true
        }).select('username email role profile associatedCaseIds');
        
        // Filter to get only this case's access info
        const usersWithAccess = users.map(user => {
            const caseAccess = user.associatedCaseIds.find(
                access => access.caseId === caseId
            );
            
            return {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile,
                accessLevel: caseAccess?.accessLevel,
                assignedAt: caseAccess?.assignedAt
            };
        });
        
        res.json({
            success: true,
            users: usersWithAccess
        });
        
    } catch (error) {
        console.error('Get case users error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching case users' 
        });
    }
});

/**
 * @route   PUT /api/cases/:caseId/status
 * @desc    Update case status (Admin only)
 * @access  Private (Admin)
 */
router.put('/:caseId/status', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['active', 'closed', 'pending', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }
        
        const caseDoc = await Case.findOne({ caseId });
        
        if (!caseDoc) {
            return res.status(404).json({ 
                success: false, 
                message: 'Case not found' 
            });
        }
        
        const oldStatus = caseDoc.status;
        caseDoc.status = status;
        
        if (status === 'closed' || status === 'archived') {
            caseDoc.isActive = false;
        }
        
        await caseDoc.save();
        
        // Add timeline entry
        await caseDoc.addTimelineEntry(
            'status_changed',
            req.user._id,
            `Case status changed from ${oldStatus} to ${status}`
        );
        
        // Log action
        await AuditLog.create({
            userId: req.user._id,
            action: 'case_status_updated',
            details: {
                caseId,
                oldStatus,
                newStatus: status
            },
            caseId,
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            message: 'Case status updated successfully',
            case: caseDoc
        });
        
    } catch (error) {
        console.error('Update case status error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating case status' 
        });
    }
});

/**
 * @route   GET /api/cases/:caseId/timeline
 * @desc    Get case timeline/history
 * @access  Private
 */
router.get('/:caseId/timeline', authMiddleware, async (req, res) => {
    try {
        const { caseId } = req.params;
        
        // Check if user has access to this case
        if (!req.user.hasAccessToCase(caseId)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have access to this case' 
            });
        }
        
        const caseDoc = await Case.findOne({ caseId })
            .populate('timeline.performedBy', 'username role');
        
        if (!caseDoc) {
            return res.status(404).json({ 
                success: false, 
                message: 'Case not found' 
            });
        }
        
        res.json({
            success: true,
            timeline: caseDoc.timeline
        });
        
    } catch (error) {
        console.error('Get case timeline error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching timeline' 
        });
    }
});

module.exports = router;
