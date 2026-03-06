import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Button, Typography, Spin, Card, Space } from 'antd'
import { GoogleOutlined } from '@ant-design/icons'
import { useAuth } from './AuthContext'
import { Logo } from './components/Logo'
import './App.css'

// Lazy load heavy components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })))
const CanvasEditor = lazy(() => import('./components/CanvasEditor').then(m => ({ default: m.CanvasEditor })))

const { Text } = Typography

function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="login-page">
      <Card className="login-page__card">
        <Space direction="vertical" size="large" align="center" style={{ width: '100%' }}>
          <Logo size={48} />
          <Text type="secondary">
            Sign in to save your drawings
          </Text>
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={signInWithGoogle}
            style={{ 
              background: '#ffffff', 
              color: '#000000',
              borderColor: '#ffffff',
            }}
          >
            Sign in with Google
          </Button>
        </Space>
      </Card>
    </div>
  )
}

// Loading fallback for lazy-loaded components
function PageLoader() {
  return (
    <div className="app-loader">
      <Spin size="large" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/canvas/:canvasId"
          element={
            <ProtectedRoute>
              <CanvasEditor />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
