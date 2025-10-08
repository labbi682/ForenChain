import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

export default function UploadEvidence() {
  const [formData, setFormData] = useState({
    file: null,
    caseNumber: '',
    description: '',
    tags: '',
    latitude: '',
    longitude: '',
    address: '',
  })
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const navigate = useNavigate()

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({ ...formData, file })
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => setPreview(reader.result)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const getLocation = () => {
    if (navigator.geolocation) {
      toast.loading('Getting location...')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          toast.dismiss()
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          })
          toast.success('Location captured')
        },
        (error) => {
          toast.dismiss()
          toast.error('Failed to get location')
        }
      )
    } else {
      toast.error('Geolocation not supported')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.file) {
      toast.error('Please select a file')
      return
    }

    setUploading(true)

    try {
      const data = new FormData()
      data.append('file', formData.file)
      data.append('caseNumber', formData.caseNumber)
      data.append('description', formData.description)
      data.append('tags', JSON.stringify(formData.tags.split(',').map(t => t.trim()).filter(t => t)))
      if (formData.latitude) data.append('latitude', formData.latitude)
      if (formData.longitude) data.append('longitude', formData.longitude)
      if (formData.address) data.append('address', formData.address)

      const response = await api.post('/evidence/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('Evidence uploaded successfully!')
      navigate(`/evidence/${response.data.evidence.evidenceId}`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Upload Evidence</h1>
        <p className="text-gray-400 mt-1">Add new digital evidence to the blockchain</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Evidence File</h3>
          
          <div className="border-2 border-dashed border-dark-600 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
              required
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-64 mx-auto mb-4 rounded-lg" />
              ) : (
                <Upload className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              )}
              <p className="text-white font-medium mb-2">
                {formData.file ? formData.file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-400">
                Images, videos, documents, logs, and more (Max 100MB)
              </p>
            </label>
          </div>
        </div>

        {/* Case Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Case Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Case Number *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g., CASE-2024-001"
                value={formData.caseNumber}
                onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                className="input"
                rows="4"
                placeholder="Describe the evidence..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., cybercrime, fraud, investigation"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Location Information</h3>
            <button
              type="button"
              onClick={getLocation}
              className="btn-secondary flex items-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Get Current Location
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Latitude
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., 40.7128"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Longitude
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., -74.0060"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address
              </label>
              <input
                type="text"
                className="input"
                placeholder="Physical location or address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={uploading}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            <span>{uploading ? 'Uploading...' : 'Upload Evidence'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/evidence')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
