const express = require('express');
const router = express.Router();
const Evidence = require('../models/EvidenceEnhanced');
const User = require('../models/UserEnhanced');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireRole } = require('./authEnhanced');
const { sendNotification } = require('../services/notifications');

/**
 * CITIZEN: Upload Evidence (Step 1)
 */
router.post('/upload', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    // Upload logic handled in evidenceEnhanced.js
    // This route ensures only citizens can initiate uploads
    res.json({ message: 'Upload endpoint - see evidenceEnhanced.js' });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POLICE: Get pending verifications
 */
router.get('/pending-verification', authenticateToken, requireRole('police'), async (req, res) => {
  try {
    const evidence = await Evidence.find({
      'workflow.status': { $in: ['uploaded', 'pending_verification'] }
    })
    .populate('uploadedBy', 'username kyc.fullName kyc.phoneNumber')
    .sort({ createdAt: -1 });

    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

/**
 * POLICE: Verify Evidence (Step 2)
 */
router.post('/:evidenceId/verify', authenticateToken, requireRole('police'), async (req, res) => {
  try {
    const { notes, verified } = req.body;
    
    const evidence = await Evidence.findOne({ evidenceId: req.params.evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidence.workflow.status !== 'uploaded' && evidence.workflow.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Evidence already processed' });
    }

    if (verified) {
      // Mark as verified
      evidence.workflow.status = 'verified';
      evidence.workflow.verifiedAt = new Date();
      evidence.workflow.verifiedBy = req.user.userId;
      
      // Move to pending approval
      evidence.workflow.status = 'pending_approval';
      
      // Grant access to police
      evidence.visibleTo.push('police');
      
      // Notify admin for approval
      const admins = await User.find({ role: 'admin', isActive: true });
      for (const admin of admins) {
        await sendNotification(admin, 'Evidence pending approval', evidence.evidenceId);
      }
      
    } else {
      // Reject verification
      evidence.workflow.status = 'rejected';
      evidence.workflow.rejectedAt = new Date();
      evidence.workflow.rejectedBy = req.user.userId;
      evidence.workflow.rejectionReason = notes || 'Failed verification';
      
      // Notify citizen
      const citizen = await User.findById(evidence.uploadedBy);
      await sendNotification(citizen, 'Evidence verification failed', evidence.evidenceId);
    }

    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: verified ? 'verify' : 'reject',
      performedBy: req.user.userId,
      details: notes || (verified ? 'Evidence verified by police' : 'Evidence rejected'),
      ipAddress: req.ip
    });

    res.json({
      message: verified ? 'Evidence verified successfully' : 'Evidence rejected',
      evidence
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * ADMIN: Get pending approvals
 */
router.get('/pending-approval', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const evidence = await Evidence.find({
      'workflow.status': 'pending_approval'
    })
    .populate('uploadedBy', 'username kyc.fullName')
    .populate('workflow.verifiedBy', 'username roleDetails.badgeNumber')
    .sort({ 'workflow.verifiedAt': -1 });

    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * ADMIN: Approve Evidence (Step 3)
 */
router.post('/:evidenceId/approve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { approved, notes } = req.body;
    
    const evidence = await Evidence.findOne({ evidenceId: req.params.evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidence.workflow.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Evidence not pending approval' });
    }

    if (approved) {
      // Approve evidence
      evidence.workflow.status = 'approved';
      evidence.workflow.approvedAt = new Date();
      evidence.workflow.approvedBy = req.user.userId;
      
      // Make visible to court officials
      evidence.visibleTo.push('court_official');
      
      // Notify relevant parties
      const citizen = await User.findById(evidence.uploadedBy);
      await sendNotification(citizen, 'Evidence approved', evidence.evidenceId);
      
    } else {
      // Reject approval
      evidence.workflow.status = 'rejected';
      evidence.workflow.rejectedAt = new Date();
      evidence.workflow.rejectedBy = req.user.userId;
      evidence.workflow.rejectionReason = notes || 'Failed admin approval';
    }

    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: approved ? 'approve' : 'reject',
      performedBy: req.user.userId,
      details: notes || (approved ? 'Evidence approved by admin' : 'Evidence rejected by admin'),
      ipAddress: req.ip
    });

    res.json({
      message: approved ? 'Evidence approved successfully' : 'Evidence rejected',
      evidence
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Approval failed' });
  }
});

/**
 * POLICE: Transfer evidence to forensic expert
 */
router.post('/:evidenceId/assign-forensic', authenticateToken, requireRole('police'), async (req, res) => {
  try {
    const { forensicExpertId, notes } = req.body;
    
    const evidence = await Evidence.findOne({ evidenceId: req.params.evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Verify forensic expert exists
    const expert = await User.findById(forensicExpertId);
    if (!expert || expert.role !== 'forensic_expert') {
      return res.status(400).json({ error: 'Invalid forensic expert' });
    }

    // Assign to forensic expert
    evidence.forensicAnalysis.assignedTo = forensicExpertId;
    evidence.forensicAnalysis.assignedAt = new Date();
    evidence.forensicAnalysis.status = 'in_progress';
    
    // Grant access to forensic expert
    evidence.visibleTo.push('forensic_expert');
    
    await evidence.save();

    // Notify forensic expert
    await sendNotification(expert, 'New case assigned', evidence.evidenceId);

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'transfer',
      performedBy: req.user.userId,
      toUser: forensicExpertId,
      details: notes || 'Evidence assigned to forensic expert',
      ipAddress: req.ip
    });

    res.json({
      message: 'Evidence assigned to forensic expert',
      evidence
    });
  } catch (error) {
    console.error('Assignment error:', error);
    res.status(500).json({ error: 'Assignment failed' });
  }
});

/**
 * FORENSIC EXPERT: Get assigned cases
 */
router.get('/my-assignments', authenticateToken, requireRole('forensic_expert'), async (req, res) => {
  try {
    const evidence = await Evidence.find({
      'forensicAnalysis.assignedTo': req.user.userId,
      'forensicAnalysis.status': { $in: ['in_progress', 'not_assigned'] }
    })
    .populate('uploadedBy', 'username')
    .sort({ 'forensicAnalysis.assignedAt': -1 });

    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

/**
 * FORENSIC EXPERT: Submit analysis report
 */
router.post('/:evidenceId/submit-analysis', authenticateToken, requireRole('forensic_expert'), async (req, res) => {
  try {
    const { findings, report } = req.body;
    
    const evidence = await Evidence.findOne({ evidenceId: req.params.evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Verify assignment
    if (evidence.forensicAnalysis.assignedTo.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not assigned to you' });
    }

    // Update analysis
    evidence.forensicAnalysis.findings = findings;
    evidence.forensicAnalysis.report = report;
    evidence.forensicAnalysis.status = 'completed';
    evidence.forensicAnalysis.completedAt = new Date();
    
    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'modify',
      performedBy: req.user.userId,
      details: 'Forensic analysis report submitted',
      ipAddress: req.ip
    });

    // Notify police
    const police = await User.find({ role: 'police', isActive: true }).limit(1);
    if (police.length > 0) {
      await sendNotification(police[0], 'Forensic analysis completed', evidence.evidenceId);
    }

    res.json({
      message: 'Analysis submitted successfully',
      evidence
    });
  } catch (error) {
    console.error('Analysis submission error:', error);
    res.status(500).json({ error: 'Submission failed' });
  }
});

/**
 * ADMIN: Close case
 */
router.post('/:evidenceId/close', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { notes } = req.body;
    
    const evidence = await Evidence.findOne({ evidenceId: req.params.evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    evidence.workflow.status = 'closed';
    evidence.workflow.closedAt = new Date();
    evidence.workflow.closedBy = req.user.userId;
    
    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'close',
      performedBy: req.user.userId,
      details: notes || 'Case closed',
      ipAddress: req.ip
    });

    res.json({
      message: 'Case closed successfully',
      evidence
    });
  } catch (error) {
    console.error('Close case error:', error);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

/**
 * Get workflow statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'citizen') {
      query.uploadedBy = req.user.userId;
    } else if (req.user.role === 'forensic_expert') {
      query['forensicAnalysis.assignedTo'] = req.user.userId;
    }

    const stats = {
      uploaded: await Evidence.countDocuments({ ...query, 'workflow.status': 'uploaded' }),
      pendingVerification: await Evidence.countDocuments({ ...query, 'workflow.status': 'pending_verification' }),
      verified: await Evidence.countDocuments({ ...query, 'workflow.status': 'verified' }),
      pendingApproval: await Evidence.countDocuments({ ...query, 'workflow.status': 'pending_approval' }),
      approved: await Evidence.countDocuments({ ...query, 'workflow.status': 'approved' }),
      rejected: await Evidence.countDocuments({ ...query, 'workflow.status': 'rejected' }),
      closed: await Evidence.countDocuments({ ...query, 'workflow.status': 'closed' })
    };

    res.json({ stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
