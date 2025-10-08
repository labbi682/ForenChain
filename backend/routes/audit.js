const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { authenticateToken } = require('./auth');
const AuditLog = require('../models/AuditLog');
const Evidence = require('../models/Evidence');

// Get audit logs for specific evidence
router.get('/evidence/:evidenceId', authenticateToken, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    
    const evidence = await Evidence.findOne({ evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const logs = await AuditLog.find({ evidenceId: evidence._id })
      .populate('performedBy', 'username role department badgeNumber')
      .populate('fromUser', 'username role')
      .populate('toUser', 'username role')
      .sort({ timestamp: -1 });

    res.json({ logs, count: logs.length });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get all audit logs (admin only)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { action, startDate, endDate, limit = 100 } = req.query;
    
    let query = {};
    
    if (action) query.action = action;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('evidenceId', 'evidenceId fileName caseNumber')
      .populate('performedBy', 'username role department')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ logs, count: logs.length });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Generate court-ready PDF report
router.get('/report/:evidenceId', authenticateToken, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    
    const evidence = await Evidence.findOne({ evidenceId })
      .populate('uploadedBy', 'username role department badgeNumber email')
      .populate('currentOwner', 'username role department badgeNumber');
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const logs = await AuditLog.find({ evidenceId: evidence._id })
      .populate('performedBy', 'username role department badgeNumber')
      .populate('fromUser', 'username role')
      .populate('toUser', 'username role')
      .sort({ timestamp: 1 });

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ForenChain_Report_${evidenceId}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('FORENCHAIN', { align: 'center' });
    doc.fontSize(16).text('Digital Evidence Chain of Custody Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Evidence Details
    doc.fontSize(14).font('Helvetica-Bold').text('Evidence Information');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    const evidenceInfo = [
      ['Evidence ID:', evidence.evidenceId],
      ['File Name:', evidence.fileName],
      ['Case Number:', evidence.caseNumber],
      ['Category:', evidence.category],
      ['File Size:', `${(evidence.fileSize / 1024).toFixed(2)} KB`],
      ['SHA-256 Hash:', evidence.hash],
      ['IPFS Hash:', evidence.ipfsHash || 'N/A'],
      ['Blockchain Tx:', evidence.blockchainTxHash || 'N/A'],
      ['Status:', evidence.status.toUpperCase()],
      ['Tampered:', evidence.isTampered ? 'YES - WARNING' : 'NO'],
      ['Verification Count:', evidence.verificationCount.toString()],
      ['Uploaded By:', `${evidence.uploadedBy.username} (${evidence.uploadedBy.role})`],
      ['Department:', evidence.uploadedBy.department || 'N/A'],
      ['Badge Number:', evidence.uploadedBy.badgeNumber || 'N/A'],
      ['Upload Date:', new Date(evidence.createdAt).toLocaleString()],
      ['Current Owner:', `${evidence.currentOwner.username} (${evidence.currentOwner.role})`]
    ];

    evidenceInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label, { continued: true, width: 150 });
      doc.font('Helvetica').text(` ${value}`);
    });

    doc.moveDown(2);

    // Chain of Custody
    doc.fontSize(14).font('Helvetica-Bold').text('Chain of Custody Timeline');
    doc.moveDown(0.5);

    if (logs.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No audit logs available.');
    } else {
      logs.forEach((log, index) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${log.action.toUpperCase()}`);
        doc.font('Helvetica');
        doc.text(`   Performed By: ${log.performedBy.username} (${log.performedBy.role})`);
        doc.text(`   Department: ${log.performedBy.department || 'N/A'}`);
        doc.text(`   Badge: ${log.performedBy.badgeNumber || 'N/A'}`);
        doc.text(`   Timestamp: ${new Date(log.timestamp).toLocaleString()}`);
        doc.text(`   IP Address: ${log.ipAddress || 'N/A'}`);
        
        if (log.fromUser && log.toUser) {
          doc.text(`   Transfer: ${log.fromUser.username} → ${log.toUser.username}`);
        }
        
        if (log.details) {
          doc.text(`   Details: ${log.details}`);
        }
        
        if (log.blockchainTxHash) {
          doc.text(`   Blockchain Tx: ${log.blockchainTxHash}`);
        }
        
        doc.moveDown(0.5);
      });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique').text(
      'This document is generated by ForenChain - a blockchain-powered digital evidence management system.',
      { align: 'center' }
    );
    doc.text(
      'All evidence metadata is cryptographically secured and stored on an immutable blockchain.',
      { align: 'center' }
    );
    doc.text(
      'This report is admissible as proof of evidence authenticity and chain of custody.',
      { align: 'center' }
    );

    // QR Code
    if (evidence.qrCode) {
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').text('Evidence QR Code:', { align: 'center' });
      doc.image(evidence.qrCode, { fit: [150, 150], align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// Get audit statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalActions = await AuditLog.countDocuments();
    const byAction = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);
    const recentActions = await AuditLog.find()
      .populate('evidenceId', 'evidenceId fileName')
      .populate('performedBy', 'username role')
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      totalActions,
      byAction,
      recentActions
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

module.exports = router;
