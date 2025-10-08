const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('./auth');
const { uploadToIPFS, getFromIPFS } = require('../services/ipfs');
const { storeOnBlockchain } = require('../services/blockchain');
const { classifyEvidence } = require('../services/aiClassifier');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload evidence
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { caseNumber, description, tags, latitude, longitude, address } = req.body;

    if (!caseNumber) {
      return res.status(400).json({ error: 'Case number is required' });
    }

    // Read file and generate hash
    const fileBuffer = await fs.readFile(req.file.path);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate evidence
    const existingEvidence = await Evidence.findOne({ hash });
    if (existingEvidence) {
      return res.status(400).json({ 
        error: 'Evidence with this hash already exists',
        existingEvidenceId: existingEvidence.evidenceId
      });
    }

    // AI-powered classification
    const category = await classifyEvidence(req.file.originalname, req.file.mimetype);

    // Generate unique evidence ID
    const evidenceId = `EV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Upload to IPFS
    let ipfsHash = null;
    try {
      ipfsHash = await uploadToIPFS(fileBuffer, req.file.originalname);
    } catch (error) {
      console.error('IPFS upload error:', error);
    }

    // Generate QR code
    const qrData = JSON.stringify({
      evidenceId,
      hash,
      caseNumber,
      uploadedAt: new Date().toISOString()
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Create evidence record
    const evidence = new Evidence({
      evidenceId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      category,
      description,
      caseNumber,
      hash,
      ipfsHash,
      uploadedBy: req.user.userId,
      currentOwner: req.user.userId,
      location: {
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || ''
      },
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress
      },
      tags: tags ? JSON.parse(tags) : [],
      qrCode
    });

    await evidence.save();

    // Store on blockchain
    let blockchainTxHash = null;
    try {
      blockchainTxHash = await storeOnBlockchain({
        evidenceId,
        hash,
        caseNumber,
        uploadedBy: req.user.userId,
        timestamp: Date.now()
      });
      evidence.blockchainTxHash = blockchainTxHash;
      await evidence.save();
    } catch (error) {
      console.error('Blockchain storage error:', error);
    }

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'upload',
      performedBy: req.user.userId,
      details: `Evidence uploaded: ${req.file.originalname}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      location: evidence.location,
      blockchainTxHash
    });

    res.status(201).json({
      message: 'Evidence uploaded successfully',
      evidence: {
        ...evidence.toObject(),
        filePath: `/uploads/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload evidence', details: error.message });
  }
});

// Get all evidence (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { caseNumber, category, status, search } = req.query;
    
    let query = {};
    
    // Role-based access control
    if (req.user.role !== 'admin') {
      query.$or = [
        { uploadedBy: req.user.userId },
        { currentOwner: req.user.userId }
      ];
    }

    if (caseNumber) query.caseNumber = caseNumber;
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fileName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { evidenceId: { $regex: search, $options: 'i' } }
      ];
    }

    const evidence = await Evidence.find(query)
      .populate('uploadedBy', 'username role department')
      .populate('currentOwner', 'username role department')
      .sort({ createdAt: -1 });

    res.json({ evidence, count: evidence.length });
  } catch (error) {
    console.error('Fetch evidence error:', error);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

// Get single evidence by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const evidence = await Evidence.findOne({ evidenceId: req.params.id })
      .populate('uploadedBy', 'username role department badgeNumber')
      .populate('currentOwner', 'username role department badgeNumber');

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Create audit log for viewing
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'view',
      performedBy: req.user.userId,
      details: `Evidence viewed: ${evidence.fileName}`,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({ evidence });
  } catch (error) {
    console.error('Fetch evidence error:', error);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

// Verify evidence integrity
router.post('/:id/verify', authenticateToken, async (req, res) => {
  try {
    const evidence = await Evidence.findOne({ evidenceId: req.params.id });

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Re-calculate hash from file
    const filePath = path.join(__dirname, '../uploads', evidence.fileName);
    let currentHash;
    try {
      const fileBuffer = await fs.readFile(filePath);
      currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      return res.status(404).json({ error: 'Evidence file not found on server' });
    }

    // Compare hashes
    const isValid = currentHash === evidence.hash;
    
    // Update evidence
    evidence.verificationCount += 1;
    evidence.lastVerified = new Date();
    if (!isValid) {
      evidence.isTampered = true;
    }
    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'verify',
      performedBy: req.user.userId,
      details: isValid ? 'Evidence verified - integrity intact' : 'TAMPERING DETECTED',
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      isValid,
      originalHash: evidence.hash,
      currentHash,
      verificationCount: evidence.verificationCount,
      message: isValid ? 'Evidence integrity verified' : 'WARNING: Evidence has been tampered with'
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify evidence' });
  }
});

// Transfer evidence ownership
router.post('/:id/transfer', authenticateToken, async (req, res) => {
  try {
    const { toUserId, reason } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const evidence = await Evidence.findOne({ evidenceId: req.params.id });

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Check if current user is the owner
    if (evidence.currentOwner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the current owner can transfer evidence' });
    }

    const fromUserId = evidence.currentOwner;
    evidence.currentOwner = toUserId;
    evidence.status = 'transferred';
    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'transfer',
      performedBy: req.user.userId,
      fromUser: fromUserId,
      toUser: toUserId,
      details: reason || 'Evidence ownership transferred',
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Evidence transferred successfully',
      evidence
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer evidence' });
  }
});

// Update evidence status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const evidence = await Evidence.findOne({ evidenceId: req.params.id });

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const oldStatus = evidence.status;
    evidence.status = status;
    await evidence.save();

    // Create audit log
    await AuditLog.create({
      evidenceId: evidence._id,
      action: 'modify',
      performedBy: req.user.userId,
      details: `Status changed from ${oldStatus} to ${status}`,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Evidence status updated',
      evidence
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get evidence statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalEvidence = await Evidence.countDocuments();
    const tamperedEvidence = await Evidence.countDocuments({ isTampered: true });
    const byCategory = await Evidence.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const byStatus = await Evidence.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      totalEvidence,
      tamperedEvidence,
      byCategory,
      byStatus
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
