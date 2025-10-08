import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import EvidenceList from './pages/EvidenceList'
import EvidenceDetail from './pages/EvidenceDetail'
import UploadEvidence from './pages/UploadEvidence'
import AuditLogs from './pages/AuditLogs'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#2d3748',
            color: '#fff',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="evidence" element={<EvidenceList />} />
          <Route path="evidence/:id" element={<EvidenceDetail />} />
          <Route path="upload" element={<UploadEvidence />} />
          <Route path="audit" element={<AuditLogs />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
