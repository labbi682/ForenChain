const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    caseName: {
        type: String,
        required: true
    },
    caseNumber: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'pending', 'archived'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedUsers: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['citizen', 'police', 'forensic', 'court', 'admin']
        },
        assignedAt: {
            type: Date,
            default: Date.now
        }
    }],
    evidenceCount: {
        type: Number,
        default: 0
    },
    metadata: {
        jurisdiction: String,
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        category: String,
        tags: [String]
    },
    timeline: [{
        action: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        details: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    blockchainTxHash: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
caseSchema.index({ caseId: 1, status: 1 });
caseSchema.index({ 'assignedUsers.userId': 1 });
caseSchema.index({ createdBy: 1 });

// Update timestamp on save
caseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to check if user has access to case
caseSchema.methods.hasUserAccess = function(userId, userRole) {
    // Admin has access to all cases
    if (userRole === 'admin') {
        return true;
    }
    
    // Check if user is assigned to this case
    return this.assignedUsers.some(assigned => 
        assigned.userId.toString() === userId.toString()
    );
};

// Method to add user to case
caseSchema.methods.assignUser = function(userId, role) {
    const existingAssignment = this.assignedUsers.find(
        assigned => assigned.userId.toString() === userId.toString()
    );
    
    if (!existingAssignment) {
        this.assignedUsers.push({
            userId,
            role,
            assignedAt: new Date()
        });
    }
    
    return this.save();
};

// Method to add timeline entry
caseSchema.methods.addTimelineEntry = function(action, performedBy, details) {
    this.timeline.push({
        action,
        performedBy,
        timestamp: new Date(),
        details
    });
    
    return this.save();
};

module.exports = mongoose.model('Case', caseSchema);
