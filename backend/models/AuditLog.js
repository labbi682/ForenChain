const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  evidenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
    required: true
  },
  action: {
    type: String,
    enum: ['upload', 'view', 'verify', 'transfer', 'modify', 'download', 'close', 'reopen'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  details: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '' }
  },
  signature: {
    type: String,
    default: null
  },
  blockchainTxHash: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for efficient queries
auditLogSchema.index({ evidenceId: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
