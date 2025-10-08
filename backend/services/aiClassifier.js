/**
 * AI-powered evidence classification
 * Uses file extension and MIME type to classify evidence
 * Can be extended with TensorFlow.js or external ML APIs
 */

const fileCategories = {
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico', '.heic', '.heif'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml']
  },
  video: {
    extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v'],
    mimeTypes: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm']
  },
  document: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  },
  audio: {
    extensions: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/flac']
  },
  log: {
    extensions: ['.log', '.txt', '.csv', '.json', '.xml'],
    mimeTypes: ['text/plain', 'text/csv', 'application/json', 'application/xml']
  },
  mobile: {
    extensions: ['.apk', '.ipa', '.db', '.sqlite', '.plist'],
    mimeTypes: ['application/vnd.android.package-archive', 'application/octet-stream']
  },
  network: {
    extensions: ['.pcap', '.pcapng', '.cap', '.dmp'],
    mimeTypes: ['application/vnd.tcpdump.pcap', 'application/octet-stream']
  }
};

/**
 * Classify evidence based on file name and MIME type
 */
async function classifyEvidence(fileName, mimeType) {
  try {
    const lowerFileName = fileName.toLowerCase();
    const lowerMimeType = mimeType ? mimeType.toLowerCase() : '';

    // Check each category
    for (const [category, patterns] of Object.entries(fileCategories)) {
      // Check extensions
      const hasMatchingExtension = patterns.extensions.some(ext => lowerFileName.endsWith(ext));
      
      // Check MIME types
      const hasMatchingMimeType = patterns.mimeTypes.some(mime => lowerMimeType.includes(mime));

      if (hasMatchingExtension || hasMatchingMimeType) {
        return capitalizeCategory(category);
      }
    }

    // Additional heuristics
    if (lowerFileName.includes('screenshot') || lowerFileName.includes('photo')) {
      return 'Image';
    }
    if (lowerFileName.includes('recording') || lowerFileName.includes('audio')) {
      return 'Audio';
    }
    if (lowerFileName.includes('report') || lowerFileName.includes('statement')) {
      return 'Document';
    }
    if (lowerFileName.includes('capture') || lowerFileName.includes('traffic')) {
      return 'Network Capture';
    }
    if (lowerFileName.includes('mobile') || lowerFileName.includes('phone')) {
      return 'Mobile Data';
    }

    return 'Other';
  } catch (error) {
    console.error('Classification error:', error);
    return 'Other';
  }
}

/**
 * Extract metadata from file (can be extended with actual file parsing)
 */
async function extractMetadata(fileBuffer, fileName, mimeType) {
  try {
    const metadata = {
      fileName,
      mimeType,
      size: fileBuffer.length,
      category: await classifyEvidence(fileName, mimeType)
    };

    // Add more sophisticated metadata extraction here
    // For example, EXIF data from images, video duration, etc.

    return metadata;
  } catch (error) {
    console.error('Metadata extraction error:', error);
    return null;
  }
}

/**
 * Analyze file for potential security threats (basic implementation)
 */
async function analyzeSecurityThreats(fileBuffer, fileName) {
  try {
    const threats = [];

    // Check file size (suspiciously large or small)
    if (fileBuffer.length > 500 * 1024 * 1024) { // 500MB
      threats.push({ type: 'size', severity: 'medium', message: 'File size exceeds normal limits' });
    }

    // Check for suspicious patterns in filename
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js'];
    if (suspiciousPatterns.some(pattern => fileName.toLowerCase().endsWith(pattern))) {
      threats.push({ type: 'extension', severity: 'high', message: 'Potentially executable file' });
    }

    // Check for double extensions
    if ((fileName.match(/\./g) || []).length > 2) {
      threats.push({ type: 'extension', severity: 'medium', message: 'Multiple file extensions detected' });
    }

    return {
      isSafe: threats.length === 0,
      threats,
      scanDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Security analysis error:', error);
    return { isSafe: true, threats: [], error: error.message };
  }
}

/**
 * Helper function to capitalize category names
 */
function capitalizeCategory(category) {
  const categoryMap = {
    image: 'Image',
    video: 'Video',
    document: 'Document',
    audio: 'Audio',
    log: 'Log',
    mobile: 'Mobile Data',
    network: 'Network Capture'
  };
  return categoryMap[category] || 'Other';
}

module.exports = {
  classifyEvidence,
  extractMetadata,
  analyzeSecurityThreats
};
