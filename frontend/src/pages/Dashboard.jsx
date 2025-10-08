import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, CheckCircle, TrendingUp, Upload, Shield } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/evidence/stats/dashboard')
      setStats(response.data)
    } catch (error) {
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#0078e6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

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
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of evidence management system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Evidence</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.totalEvidence || 0}</p>
            </div>
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-400">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Active cases</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Verified</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats?.totalEvidence - (stats?.tamperedEvidence || 0) || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-400">
            <Shield className="w-4 h-4 mr-1" />
            <span>Integrity intact</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Tampered</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.tamperedEvidence || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 mr-1" />
            <span>Requires attention</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Quick Upload</p>
              <p className="text-sm font-medium text-white mt-1">Add new evidence</p>
            </div>
            <Link to="/upload" className="w-12 h-12 bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center justify-center transition-colors">
              <Upload className="w-6 h-6 text-white" />
            </Link>
          </div>
          <div className="mt-4">
            <Link to="/upload" className="text-sm text-primary-400 hover:text-primary-300">
              Upload evidence →
            </Link>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Evidence by Category</h3>
          {stats?.byCategory && stats.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byCategory}
                  dataKey="count"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry._id}: ${entry.count}`}
                >
                  {stats.byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No data available</p>
          )}
        </div>

        {/* Status Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Evidence by Status</h3>
          {stats?.byStatus && stats.byStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="_id" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#0078e6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No data available</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/upload" className="p-4 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
            <Upload className="w-8 h-8 text-primary-500 mb-2" />
            <h4 className="font-medium text-white">Upload Evidence</h4>
            <p className="text-sm text-gray-400 mt-1">Add new digital evidence</p>
          </Link>
          <Link to="/evidence" className="p-4 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
            <FileText className="w-8 h-8 text-primary-500 mb-2" />
            <h4 className="font-medium text-white">View Evidence</h4>
            <p className="text-sm text-gray-400 mt-1">Browse all evidence files</p>
          </Link>
          <Link to="/audit" className="p-4 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
            <Shield className="w-8 h-8 text-primary-500 mb-2" />
            <h4 className="font-medium text-white">Audit Logs</h4>
            <p className="text-sm text-gray-400 mt-1">View chain of custody</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
