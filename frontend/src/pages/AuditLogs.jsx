import { useEffect, useState } from 'react'
import { Clock, User, FileText } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await api.get('/audit/all?limit=50')
      setLogs(response.data.logs)
    } catch (error) {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
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
      <div>
        <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
        <p className="text-gray-400 mt-1">Complete chain of custody timeline</p>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No audit logs available</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log._id} className="flex gap-4 p-4 bg-dark-700 rounded-lg">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge badge-info uppercase">{log.action}</span>
                    <span className="text-sm text-gray-400">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white mb-1">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{log.performedBy?.username}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400 text-sm">{log.performedBy?.role}</span>
                  </div>
                  {log.evidenceId && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <FileText className="w-4 h-4" />
                      <span>{log.evidenceId.evidenceId} - {log.evidenceId.fileName}</span>
                    </div>
                  )}
                  {log.details && (
                    <p className="text-gray-300 text-sm mt-2">{log.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
