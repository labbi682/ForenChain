const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['Image', 'Video', 'Document', 'Audio', 'Log', 'Mobile Data', 'Network Capture', 'Other'],
    default: 'Other'
  },
  description: {
    type: String,
    default: ''
  },
  caseNumber: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true,
    unique: true
  },
  ipfsHash: {
    type: String,
    default: null
  },
  blockchainTxHash: {
    type: String,
    default: null
  },
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
  status: {
    type: String,
    enum: ['uploaded', 'verified', 'in_analysis', 'transferred', 'closed'],
    default: 'uploaded'
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '' }
  },
  deviceInfo: {
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' }
  },
  tags: [{
    type: String
  }],
  isTampered: {
    type: Boolean,
    default: false
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  lastVerified: {
    type: Date,
    default: null
  },
  qrCode: {
    type: String,
    default: null
  },
  metadata: {
    type: Map,
    of: String
  }
}, { timestamps: true });

// Index for faster searches
evidenceSchema.index({ evidenceId: 1, hash: 1, caseNumber: 1 });
evidenceSchema.index({ uploadedBy: 1, currentOwner: 1 });
evidenceSchema.index({ status: 1, category: 1 });

module.exports = mongoose.model('Evidence', evidenceSchema);
