const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const { getBlockchainTransaction, verifyOnBlockchain } = require('../services/blockchain');

// Get blockchain transaction details
router.get('/transaction/:txHash', authenticateToken, async (req, res) => {
  try {
    const { txHash } = req.params;
    
    const transaction = await getBlockchainTransaction(txHash);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Blockchain transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain transaction' });
  }
});

// Verify evidence on blockchain
router.post('/verify/:evidenceId', authenticateToken, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    
    const evidence = await Evidence.findOne({ evidenceId });
    
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (!evidence.blockchainTxHash) {
      return res.status(400).json({ error: 'Evidence not yet stored on blockchain' });
    }

    const verification = await verifyOnBlockchain(evidence.blockchainTxHash, evidence.hash);

    res.json({
      isValid: verification.isValid,
      blockchainHash: verification.blockchainHash,
      localHash: evidence.hash,
      timestamp: verification.timestamp,
      blockNumber: verification.blockNumber
    });
  } catch (error) {
    console.error('Blockchain verification error:', error);
    res.status(500).json({ error: 'Failed to verify on blockchain' });
  }
});

// Get blockchain statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalOnChain = await Evidence.countDocuments({ blockchainTxHash: { $ne: null } });
    const pendingOnChain = await Evidence.countDocuments({ blockchainTxHash: null });
    
    const recentTransactions = await Evidence.find({ blockchainTxHash: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('evidenceId fileName blockchainTxHash createdAt');

    res.json({
      totalOnChain,
      pendingOnChain,
      recentTransactions
    });
  } catch (error) {
    console.error('Blockchain stats error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain statistics' });
  }
});

module.exports = router;
