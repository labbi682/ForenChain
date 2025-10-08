const axios = require('axios');
const FormData = require('form-data');

// IPFS configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_JWT = process.env.PINATA_JWT || '';

/**
 * Upload file to IPFS using Pinata
 */
async function uploadToIPFS(fileBuffer, fileName) {
  try {
    if (!PINATA_JWT && !PINATA_API_KEY) {
      console.warn('⚠️ IPFS credentials not configured, skipping upload');
      return null;
    }

    const formData = new FormData();
    formData.append('file', fileBuffer, fileName);

    const metadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        uploadedBy: 'ForenChain',
        timestamp: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', options);

    const headers = PINATA_JWT 
      ? { 'Authorization': `Bearer ${PINATA_JWT}` }
      : {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        };

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...headers,
          ...formData.getHeaders()
        }
      }
    );

    console.log(`✅ File uploaded to IPFS: ${response.data.IpfsHash}`);
    return response.data.IpfsHash;
  } catch (error) {
    console.error('IPFS upload error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get file from IPFS
 */
async function getFromIPFS(ipfsHash) {
  try {
    const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
  } catch (error) {
    console.error('IPFS retrieval error:', error.message);
    throw error;
  }
}

/**
 * Pin existing IPFS hash
 */
async function pinToIPFS(ipfsHash) {
  try {
    if (!PINATA_JWT && !PINATA_API_KEY) {
      console.warn('⚠️ IPFS credentials not configured');
      return null;
    }

    const headers = PINATA_JWT 
      ? { 'Authorization': `Bearer ${PINATA_JWT}` }
      : {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        };

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinByHash',
      { hashToPin: ipfsHash },
      { headers }
    );

    console.log(`✅ Hash pinned to IPFS: ${ipfsHash}`);
    return response.data;
  } catch (error) {
    console.error('IPFS pinning error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Unpin file from IPFS
 */
async function unpinFromIPFS(ipfsHash) {
  try {
    if (!PINATA_JWT && !PINATA_API_KEY) {
      return null;
    }

    const headers = PINATA_JWT 
      ? { 'Authorization': `Bearer ${PINATA_JWT}` }
      : {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        };

    await axios.delete(
      `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
      { headers }
    );

    console.log(`✅ Hash unpinned from IPFS: ${ipfsHash}`);
    return true;
  } catch (error) {
    console.error('IPFS unpinning error:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  uploadToIPFS,
  getFromIPFS,
  pinToIPFS,
  unpinFromIPFS
};
