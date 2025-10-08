const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true
  },
  
  // File Information
  fileName: {
    type: String,
    required: true
  },
  fileType: String,
  fileSize: Number,
  category: {
    type: String,
    enum: ['Image', 'Video', 'Document', 'Audio', 'Log', 'Mobile Data', 'Network Capture', 'Other'],
    default: 'Other'
  },
  
  // Encryption
  encryptedFileUrl: String, // Encrypted file storage location
  encryptionMetadata: {
    algorithm: { type: String, default: 'AES-256-GCM' },
    iv: String, // Initialization vector
    authTag: String,
    encryptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Access Control - Role-based encrypted keys
  accessKeys: [{
    role: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    encryptedKey: String, // File key encrypted with user's public key
    grantedAt: { type: Date, default: Date.now },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Case Information
  caseNumber: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  tags: [String],
  
  // Cryptographic Hashes
  hash: {
    type: String,
    required: true,
    unique: true
  },
  ipfsHash: String,
  blockchainTxHash: String,
  
  // Ownership & Access
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Approval Workflow
  workflow: {
    status: {
      type: String,
      enum: ['uploaded', 'pending_verification', 'verified', 'pending_approval', 'approved', 'rejected', 'closed'],
      default: 'uploaded'
    },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Forensic Analysis (for forensic experts)
  forensicAnalysis: {
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    status: {
      type: String,
      enum: ['not_assigned', 'in_progress', 'completed'],
      default: 'not_assigned'
    },
    findings: String,
    report: String,
    completedAt: Date
  },
  
  // Location Data
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    capturedAt: Date
  },
  
  // Device Information
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    deviceId: String
  },
  
  // Integrity & Security
  isTampered: {
    type: Boolean,
    default: false
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  lastVerified: Date,
  
  // QR Code for verification
  qrCode: String,
  
  // Visibility Control (role-based)
  visibleTo: [{
    type: String,
    enum: ['citizen', 'police', 'forensic_expert', 'court_official', 'admin']
  }],
  
  // Metadata
  metadata: {
    type: Map,
    of: String
  }
  
}, { timestamps: true });

// Indexes for performance
evidenceSchema.index({ evidenceId: 1, hash: 1, caseNumber: 1 });
evidenceSchema.index({ uploadedBy: 1, currentOwner: 1 });
evidenceSchema.index({ 'workflow.status': 1 });
evidenceSchema.index({ 'forensicAnalysis.assignedTo': 1 });

// Check if user can access this evidence
evidenceSchema.methods.canUserAccess = function(user) {
  // Admin can access everything
  if (user.role === 'admin') return true;
  
  // Citizen can only access their own uploads
  if (user.role === 'citizen') {
    return this.uploadedBy.toString() === user._id.toString();
  }
  
  // Police can access all evidence
  if (user.role === 'police') {
    return true;
  }
  
  // Forensic expert can access assigned cases
  if (user.role === 'forensic_expert') {
    return this.forensicAnalysis.assignedTo && 
           this.forensicAnalysis.assignedTo.toString() === user._id.toString();
  }
  
  // Court officials can only access approved evidence
  if (user.role === 'court_official') {
    return this.workflow.status === 'approved';
  }
  
  return false;
};

// Get user's decryption key for this evidence
evidenceSchema.methods.getDecryptionKey = function(userId) {
  const accessKey = this.accessKeys.find(
    key => key.userId.toString() === userId.toString()
  );
  return accessKey ? accessKey.encryptedKey : null;
};

// Grant access to user
evidenceSchema.methods.grantAccess = function(userId, role, encryptedKey, grantedBy) {
  // Check if access already exists
  const existing = this.accessKeys.find(
    key => key.userId.toString() === userId.toString()
  );
  
  if (!existing) {
    this.accessKeys.push({
      role,
      userId,
      encryptedKey,
      grantedBy
    });
  }
};

// Revoke access from user
evidenceSchema.methods.revokeAccess = function(userId) {
  this.accessKeys = this.accessKeys.filter(
    key => key.userId.toString() !== userId.toString()
  );
};

module.exports = mongoose.model('Evidence', evidenceSchema);
