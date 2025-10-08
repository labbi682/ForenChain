import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, FileText, AlertTriangle, CheckCircle, Eye } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function EvidenceList() {
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    status: '',
  })

  useEffect(() => {
    fetchEvidence()
  }, [filters])

  const fetchEvidence = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)

      const response = await api.get(`/evidence?${params}`)
      setEvidence(response.data.evidence)
    } catch (error) {
      toast.error('Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchEvidence()
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Image': 'bg-blue-900 text-blue-200',
      'Video': 'bg-purple-900 text-purple-200',
      'Document': 'bg-green-900 text-green-200',
      'Audio': 'bg-yellow-900 text-yellow-200',
      'Log': 'bg-gray-900 text-gray-200',
      'Mobile Data': 'bg-pink-900 text-pink-200',
      'Network Capture': 'bg-indigo-900 text-indigo-200',
    }
    return colors[category] || 'bg-gray-900 text-gray-200'
  }

  const getStatusColor = (status) => {
    const colors = {
      'uploaded': 'bg-blue-900 text-blue-200',
      'verified': 'bg-green-900 text-green-200',
      'in_analysis': 'bg-yellow-900 text-yellow-200',
      'transferred': 'bg-purple-900 text-purple-200',
      'closed': 'bg-gray-900 text-gray-200',
    }
    return colors[status] || 'bg-gray-900 text-gray-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Evidence</h1>
          <p className="text-gray-400 mt-1">Manage and track digital evidence</p>
        </div>
        <Link to="/upload" className="btn-primary">
          Upload Evidence
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by evidence ID, filename, or case number..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input md:w-48"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="Image">Image</option>
            <option value="Video">Video</option>
            <option value="Document">Document</option>
            <option value="Audio">Audio</option>
            <option value="Log">Log</option>
            <option value="Mobile Data">Mobile Data</option>
            <option value="Network Capture">Network Capture</option>
          </select>
          <select
            className="input md:w-48"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="uploaded">Uploaded</option>
            <option value="verified">Verified</option>
            <option value="in_analysis">In Analysis</option>
            <option value="transferred">Transferred</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Evidence List */}
      <div className="space-y-4">
        {evidence.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No evidence found</h3>
            <p className="text-gray-400">Upload your first evidence to get started</p>
            <Link to="/upload" className="btn-primary mt-4 inline-block">
              Upload Evidence
            </Link>
          </div>
        ) : (
          evidence.map((item) => (
            <div key={item._id} className="card hover:border-primary-600 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{item.fileName}</h3>
                    <span className={`badge ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                    <span className={`badge ${getStatusColor(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    {item.isTampered && (
                      <span className="badge badge-danger flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Tampered
                      </span>
                    )}
                    {!item.isTampered && item.verificationCount > 0 && (
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Evidence ID:</span>
                      <p className="text-white font-mono">{item.evidenceId}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Case Number:</span>
                      <p className="text-white">{item.caseNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Uploaded By:</span>
                      <p className="text-white">{item.uploadedBy?.username}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Upload Date:</span>
                      <p className="text-white">{format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="text-gray-400 text-sm">Hash:</span>
                    <p className="text-xs text-gray-500 font-mono break-all">{item.hash}</p>
                  </div>
                </div>

                <Link
                  to={`/evidence/${item.evidenceId}`}
                  className="btn-secondary flex items-center gap-2 ml-4"
                >
                  <Eye className="w-4 h-4" />
                  View
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
