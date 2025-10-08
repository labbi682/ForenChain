import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  FileText, Download, Shield, AlertTriangle, CheckCircle, 
  Clock, User, MapPin, Hash, Link as LinkIcon, ArrowLeft 
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { format } from 'date-fns'

export default function EvidenceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    fetchEvidence()
    fetchAuditLogs()
  }, [id])

  const fetchEvidence = async () => {
    try {
      const response = await api.get(`/evidence/${id}`)
      setEvidence(response.data.evidence)
    } catch (error) {
      toast.error('Failed to load evidence')
      navigate('/evidence')
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await api.get(`/audit/evidence/${id}`)
      setAuditLogs(response.data.logs)
    } catch (error) {
      console.error('Failed to load audit logs')
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const response = await api.post(`/evidence/${id}/verify`)
      if (response.data.isValid) {
        toast.success('Evidence verified - integrity intact!')
      } else {
        toast.error('WARNING: Evidence has been tampered with!')
      }
      fetchEvidence()
    } catch (error) {
      toast.error('Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleDownloadReport = async () => {
    try {
      const response = await api.get(`/audit/report/${id}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ForenChain_Report_${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Report downloaded')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!evidence) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evidence')} className="btn-secondary">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">{evidence.fileName}</h1>
            <p className="text-gray-400 mt-1">Evidence ID: {evidence.evidenceId}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleVerify} disabled={verifying} className="btn-secondary">
            <Shield className="w-5 h-5 mr-2" />
            {verifying ? 'Verifying...' : 'Verify Integrity'}
          </button>
          <button onClick={handleDownloadReport} className="btn-primary">
            <Download className="w-5 h-5 mr-2" />
            Download Report
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {evidence.isTampered && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-200">Tampering Detected</h3>
            <p className="text-red-300 text-sm mt-1">
              This evidence has been flagged as potentially tampered. Please review the audit logs.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Evidence Details */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Evidence Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">File Name</p>
                <p className="text-white font-medium">{evidence.fileName}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">File Type</p>
                <p className="text-white font-medium">{evidence.fileType}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Category</p>
                <span className="badge badge-info">{evidence.category}</span>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Status</p>
                <span className="badge badge-success">{evidence.status}</span>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">File Size</p>
                <p className="text-white font-medium">{(evidence.fileSize / 1024).toFixed(2)} KB</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Case Number</p>
                <p className="text-white font-medium">{evidence.caseNumber}</p>
              </div>
            </div>

            {evidence.description && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-1">Description</p>
                <p className="text-white">{evidence.description}</p>
              </div>
            )}

            {evidence.tags && evidence.tags.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {evidence.tags.map((tag, i) => (
                    <span key={i} className="badge badge-info">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Cryptographic Information
            </h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-1">SHA-256 Hash</p>
                <p className="text-white font-mono text-xs break-all bg-dark-700 p-3 rounded">
                  {evidence.hash}
                </p>
              </div>
              {evidence.ipfsHash && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">IPFS Hash</p>
                  <p className="text-white font-mono text-xs break-all bg-dark-700 p-3 rounded">
                    {evidence.ipfsHash}
                  </p>
                </div>
              )}
              {evidence.blockchainTxHash && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Blockchain Transaction</p>
                  <p className="text-white font-mono text-xs break-all bg-dark-700 p-3 rounded">
                    {evidence.blockchainTxHash}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Verification Count</p>
                <p className="text-white font-medium">{evidence.verificationCount}</p>
              </div>
              {evidence.lastVerified && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Last Verified</p>
                  <p className="text-white font-medium">
                    {format(new Date(evidence.lastVerified), 'MMM dd, HH:mm')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chain of Custody */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Chain of Custody</h3>
            
            {auditLogs.length === 0 ? (
              <p className="text-gray-400">No audit logs available</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log, index) => (
                  <div key={log._id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      {index < auditLogs.length - 1 && (
                        <div className="w-0.5 h-full bg-dark-600 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="badge badge-info uppercase">{log.action}</span>
                        <span className="text-sm text-gray-400">
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-white font-medium">{log.performedBy?.username}</p>
                      <p className="text-gray-400 text-sm">
                        {log.performedBy?.role} • {log.performedBy?.department || 'N/A'}
                      </p>
                      {log.details && (
                        <p className="text-gray-300 text-sm mt-1">{log.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-white mb-4">QR Code</h3>
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG value={evidence.evidenceId} size={200} />
            </div>
            <p className="text-gray-400 text-sm mt-3">Scan for quick verification</p>
          </div>

          {/* Upload Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Upload Information</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-sm">Uploaded By</p>
                  <p className="text-white font-medium">{evidence.uploadedBy?.username}</p>
                  <p className="text-gray-400 text-xs">{evidence.uploadedBy?.role}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-sm">Upload Date</p>
                  <p className="text-white font-medium">
                    {format(new Date(evidence.createdAt), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {format(new Date(evidence.createdAt), 'HH:mm:ss')}
                  </p>
                </div>
              </div>
              {evidence.location?.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-400 text-sm">Location</p>
                    <p className="text-white text-sm">{evidence.location.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Owner */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Current Owner</h3>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">{evidence.currentOwner?.username}</p>
                <p className="text-gray-400 text-sm">{evidence.currentOwner?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
