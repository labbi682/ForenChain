const { ethers } = require('ethers');

// Blockchain configuration (Polygon Mumbai Testnet or local)
const BLOCKCHAIN_RPC = process.env.BLOCKCHAIN_RPC || 'https://rpc-mumbai.maticvigil.com/';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';

// Simple in-memory blockchain simulation for development
const blockchainStorage = new Map();
let blockCounter = 0;

/**
 * Store evidence metadata on blockchain
 */
async function storeOnBlockchain(evidenceData) {
  try {
    // For production, use actual blockchain
    if (CONTRACT_ADDRESS && PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return await storeOnRealBlockchain(evidenceData);
    }
    
    // Development mode: simulate blockchain storage
    const txHash = `0x${Buffer.from(`${Date.now()}-${Math.random()}`).toString('hex').substring(0, 64)}`;
    const block = {
      blockNumber: ++blockCounter,
      txHash,
      timestamp: Date.now(),
      data: evidenceData
    };
    
    blockchainStorage.set(txHash, block);
    
    console.log(`✅ Evidence stored on blockchain (simulated): ${txHash}`);
    return txHash;
  } catch (error) {
    console.error('Blockchain storage error:', error);
    throw error;
  }
}

/**
 * Store on real blockchain (Polygon/Ethereum)
 */
async function storeOnRealBlockchain(evidenceData) {
  try {
    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Contract ABI (simplified)
    const contractABI = [
      "function storeEvidence(string evidenceId, string hash, string caseNumber, uint256 timestamp) public returns (bool)",
      "function getEvidence(string evidenceId) public view returns (string, string, string, uint256, address)"
    ];
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
    
    const tx = await contract.storeEvidence(
      evidenceData.evidenceId,
      evidenceData.hash,
      evidenceData.caseNumber,
      evidenceData.timestamp
    );
    
    const receipt = await tx.wait();
    console.log(`✅ Evidence stored on blockchain: ${receipt.hash}`);
    
    return receipt.hash;
  } catch (error) {
    console.error('Real blockchain storage error:', error);
    throw error;
  }
}

/**
 * Get blockchain transaction details
 */
async function getBlockchainTransaction(txHash) {
  try {
    // Check simulated storage first
    if (blockchainStorage.has(txHash)) {
      return blockchainStorage.get(txHash);
    }
    
    // Try real blockchain
    if (CONTRACT_ADDRESS) {
      const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: (await provider.getBlock(receipt.blockNumber)).timestamp * 1000,
        from: tx.from,
        to: tx.to,
        data: tx.data
      };
    }
    
    return null;
  } catch (error) {
    console.error('Get transaction error:', error);
    return null;
  }
}

/**
 * Verify evidence on blockchain
 */
async function verifyOnBlockchain(txHash, expectedHash) {
  try {
    const transaction = await getBlockchainTransaction(txHash);
    
    if (!transaction) {
      return { isValid: false, error: 'Transaction not found' };
    }
    
    const blockchainHash = transaction.data?.hash || expectedHash;
    
    return {
      isValid: blockchainHash === expectedHash,
      blockchainHash,
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber
    };
  } catch (error) {
    console.error('Blockchain verification error:', error);
    return { isValid: false, error: error.message };
  }
}

/**
 * Get blockchain statistics
 */
function getBlockchainStats() {
  return {
    totalBlocks: blockCounter,
    totalTransactions: blockchainStorage.size,
    mode: CONTRACT_ADDRESS ? 'production' : 'development'
  };
}

module.exports = {
  storeOnBlockchain,
  getBlockchainTransaction,
  verifyOnBlockchain,
  getBlockchainStats
};
