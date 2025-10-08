const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const {
    authenticate,
    verifyCaseAccess,
    requireRole,
    requireCaseAccessLevel,
    logAction
} = require('../middleware/caseAccessControl');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads', req.body.caseId);
        
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types for evidence
        cb(null, true);
    }
});

// Helper function to encrypt file content
const encryptFile = (buffer, key) => {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex')
    };
};

// Helper function to decrypt file content
const decryptFile = (encryptedData, key, iv) => {
    const algorithm = 'aes-256-cbc';
    const decipher = crypto.createDecipheriv(
        algorithm,
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
};

// Helper function to generate file hash
const generateFileHash = (buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * @route   POST /api/evidence/upload
 * @desc    Upload evidence to a specific case
 * @access  Private (Citizen, Police, Forensic)
 */
router.post('/upload',
    authenticate,
    upload.single('evidenceFile'),
    verifyCaseAccess('caseId'),
    requireCaseAccessLevel('write'),
    logAction('evidence_upload'),
    async (req, res) => {
        try {
            const { caseId, caseNumber, description, category } = req.body;
            
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }
            
            // Read file content
            const fileBuffer = await fs.readFile(req.file.path);
            
            // Generate file hash
            const fileHash = generateFileHash(fileBuffer);
            
            // Generate encryption key
            const encryptionKey = crypto.randomBytes(32).toString('hex');
            
            // Encrypt file
            const { iv, encryptedData } = encryptFile(fileBuffer, encryptionKey);
            
            // Save encrypted file
            const encryptedFilePath = req.file.path + '.encrypted';
            await fs.writeFile(encryptedFilePath, encryptedData, 'hex');
            
            // Delete original unencrypted file
            await fs.unlink(req.file.path);
            
            // Generate unique evidence ID
            const evidenceId = `EV-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            
            // Create evidence record
            const evidenceRecord = {
                evidenceId,
                caseId,
                caseNumber,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
                fileHash,
                encryptedFilePath,
                encryptionKey, // In production, store this securely (e.g., key management service)
                encryptionIV: iv,
                description,
                category,
                uploadedBy: req.user._id,
                uploadedByUsername: req.user.username,
                uploadedByRole: req.user.role,
                status: 'uploaded',
                uploadedAt: new Date(),
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                }
            };
            
            // Store in database (you'll need an Evidence model)
            // For now, we'll add to case timeline
            await req.case.addTimelineEntry(
                'evidence_uploaded',
                req.user._id,
                `Evidence uploaded: ${req.file.originalname} (${evidenceId})`
            );
            
            // Update case evidence count
            req.case.evidenceCount += 1;
            await req.case.save();
            
            // Log to audit trail
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_uploaded',
                details: {
                    evidenceId,
                    caseId,
                    fileName: req.file.originalname,
                    fileHash,
                    fileSize: req.file.size
                },
                caseId,
                timestamp: new Date()
            });
            
            res.status(201).json({
                success: true,
                message: 'Evidence uploaded and encrypted successfully',
                evidence: {
                    evidenceId,
                    fileName: req.file.originalname,
                    fileHash,
                    uploadedAt: evidenceRecord.uploadedAt,
                    status: 'uploaded'
                }
            });
            
        } catch (error) {
            console.error('Evidence upload error:', error);
            
            // Clean up file if exists
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('Error deleting file:', unlinkError);
                }
            }
            
            res.status(500).json({
                success: false,
                message: 'Error uploading evidence'
            });
        }
    }
);

/**
 * @route   GET /api/evidence/case/:caseId
 * @desc    Get all evidence for a specific case
 * @access  Private
 */
router.get('/case/:caseId',
    authenticate,
    verifyCaseAccess('caseId'),
    logAction('evidence_list_viewed'),
    async (req, res) => {
        try {
            const { caseId } = req.params;
            
            // Get evidence from case directory
            const uploadDir = path.join(__dirname, '../uploads', caseId);
            
            let evidenceList = [];
            
            try {
                const files = await fs.readdir(uploadDir);
                
                // Filter encrypted files
                const encryptedFiles = files.filter(f => f.endsWith('.encrypted'));
                
                // Get file stats
                evidenceList = await Promise.all(
                    encryptedFiles.map(async (file) => {
                        const filePath = path.join(uploadDir, file);
                        const stats = await fs.stat(filePath);
                        
                        return {
                            fileName: file.replace('.encrypted', ''),
                            fileSize: stats.size,
                            uploadedAt: stats.birthtime,
                            filePath: file
                        };
                    })
                );
            } catch (error) {
                // Directory doesn't exist or is empty
                evidenceList = [];
            }
            
            // Log access
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_list_accessed',
                details: {
                    caseId,
                    evidenceCount: evidenceList.length
                },
                caseId,
                timestamp: new Date()
            });
            
            res.json({
                success: true,
                caseId,
                evidenceCount: evidenceList.length,
                evidence: evidenceList
            });
            
        } catch (error) {
            console.error('Get evidence error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving evidence'
            });
        }
    }
);

/**
 * @route   GET /api/evidence/download/:caseId/:evidenceId
 * @desc    Download and decrypt evidence file
 * @access  Private
 */
router.get('/download/:caseId/:evidenceId',
    authenticate,
    verifyCaseAccess('caseId'),
    logAction('evidence_downloaded'),
    async (req, res) => {
        try {
            const { caseId, evidenceId } = req.params;
            
            // In production, retrieve evidence record from database
            // For now, we'll look for the file
            const uploadDir = path.join(__dirname, '../uploads', caseId);
            
            // Find file (simplified - in production, use database)
            const files = await fs.readdir(uploadDir);
            const evidenceFile = files.find(f => f.includes(evidenceId));
            
            if (!evidenceFile) {
                return res.status(404).json({
                    success: false,
                    message: 'Evidence not found'
                });
            }
            
            const filePath = path.join(uploadDir, evidenceFile);
            
            // Read encrypted file
            const encryptedData = await fs.readFile(filePath, 'utf8');
            
            // In production, retrieve encryption key and IV from secure storage
            // For demo, we'll send the encrypted file
            
            // Log download
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_downloaded',
                details: {
                    evidenceId,
                    caseId,
                    fileName: evidenceFile
                },
                caseId,
                timestamp: new Date()
            });
            
            res.json({
                success: true,
                message: 'Evidence retrieved',
                evidenceId,
                fileName: evidenceFile,
                note: 'File is encrypted. Decryption key required.'
            });
            
        } catch (error) {
            console.error('Download evidence error:', error);
            res.status(500).json({
                success: false,
                message: 'Error downloading evidence'
            });
        }
    }
);

/**
 * @route   POST /api/evidence/verify/:evidenceId
 * @desc    Verify evidence (Police only)
 * @access  Private (Police)
 */
router.post('/verify/:evidenceId',
    authenticate,
    requireRole('police', 'admin'),
    logAction('evidence_verified'),
    async (req, res) => {
        try {
            const { evidenceId } = req.params;
            const { caseId, verificationNotes } = req.body;
            
            // Verify user has access to this case
            if (!req.user.hasAccessToCase(caseId)) {
                return res.status(403).json({
                    success: false,
                    message: 'No access to this case'
                });
            }
            
            const caseDoc = await Case.findOne({ caseId });
            
            if (!caseDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Case not found'
                });
            }
            
            // Add verification to case timeline
            await caseDoc.addTimelineEntry(
                'evidence_verified',
                req.user._id,
                `Evidence ${evidenceId} verified by ${req.user.username}. Notes: ${verificationNotes || 'None'}`
            );
            
            // Log verification
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_verified',
                details: {
                    evidenceId,
                    caseId,
                    verificationNotes
                },
                caseId,
                timestamp: new Date()
            });
            
            res.json({
                success: true,
                message: 'Evidence verified successfully',
                evidenceId,
                verifiedBy: req.user.username,
                verifiedAt: new Date()
            });
            
        } catch (error) {
            console.error('Verify evidence error:', error);
            res.status(500).json({
                success: false,
                message: 'Error verifying evidence'
            });
        }
    }
);

/**
 * @route   POST /api/evidence/approve/:evidenceId
 * @desc    Approve evidence for court submission (Admin only)
 * @access  Private (Admin)
 */
router.post('/approve/:evidenceId',
    authenticate,
    requireRole('admin'),
    logAction('evidence_approved'),
    async (req, res) => {
        try {
            const { evidenceId } = req.params;
            const { caseId, approvalNotes } = req.body;
            
            const caseDoc = await Case.findOne({ caseId });
            
            if (!caseDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Case not found'
                });
            }
            
            // Add approval to case timeline
            await caseDoc.addTimelineEntry(
                'evidence_approved',
                req.user._id,
                `Evidence ${evidenceId} approved by ${req.user.username}. Notes: ${approvalNotes || 'None'}`
            );
            
            // Log approval
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_approved',
                details: {
                    evidenceId,
                    caseId,
                    approvalNotes
                },
                caseId,
                timestamp: new Date()
            });
            
            res.json({
                success: true,
                message: 'Evidence approved for court submission',
                evidenceId,
                approvedBy: req.user.username,
                approvedAt: new Date()
            });
            
        } catch (error) {
            console.error('Approve evidence error:', error);
            res.status(500).json({
                success: false,
                message: 'Error approving evidence'
            });
        }
    }
);

/**
 * @route   GET /api/evidence/hash/:caseId/:evidenceId
 * @desc    Get evidence hash for verification
 * @access  Private
 */
router.get('/hash/:caseId/:evidenceId',
    authenticate,
    verifyCaseAccess('caseId'),
    logAction('evidence_hash_retrieved'),
    async (req, res) => {
        try {
            const { caseId, evidenceId } = req.params;
            
            // In production, retrieve from database
            // For demo, calculate from file
            const uploadDir = path.join(__dirname, '../uploads', caseId);
            const files = await fs.readdir(uploadDir);
            const evidenceFile = files.find(f => f.includes(evidenceId));
            
            if (!evidenceFile) {
                return res.status(404).json({
                    success: false,
                    message: 'Evidence not found'
                });
            }
            
            const filePath = path.join(uploadDir, evidenceFile);
            const fileBuffer = await fs.readFile(filePath);
            const fileHash = generateFileHash(fileBuffer);
            
            // Log hash retrieval
            await AuditLog.create({
                userId: req.user._id,
                action: 'evidence_hash_retrieved',
                details: {
                    evidenceId,
                    caseId
                },
                caseId,
                timestamp: new Date()
            });
            
            res.json({
                success: true,
                evidenceId,
                hash: fileHash,
                algorithm: 'SHA-256'
            });
            
        } catch (error) {
            console.error('Get hash error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving evidence hash'
            });
        }
    }
);

module.exports = router;
