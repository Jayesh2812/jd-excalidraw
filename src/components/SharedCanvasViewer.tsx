import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Button, Typography, Spin, Space, Avatar, theme } from 'antd'
import {
  ArrowLeftOutlined,
  CopyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'

const { Header } = Layout
const { Title, Text } = Typography

interface CanvasData {
  name: string
  elements: readonly any[]
  appState: any
  files: any
  ownerName: string
  ownerPhoto: string
}

export function SharedCanvasViewer() {
  const { userId, canvasId } = useParams<{ userId: string; canvasId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cloning, setCloning] = useState(false)
  const { token } = theme.useToken()

  useEffect(() => {
    if (!userId || !canvasId) return

    const loadCanvas = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'canvases', canvasId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const docData = docSnap.data()

          // Check if canvas is shared
          if (!docData.isShared) {
            setError('This canvas is not shared')
            setLoading(false)
            return
          }

          let canvasContent: CanvasData
          if (docData.content) {
            const parsed = JSON.parse(docData.content)
            canvasContent = {
              name: docData.name,
              elements: parsed.elements || [],
              appState: parsed.appState || {},
              files: parsed.files || {},
              ownerName: docData.ownerName || 'Anonymous',
              ownerPhoto: docData.ownerPhoto || '',
            }
          } else {
            canvasContent = {
              name: docData.name,
              elements: docData.elements || [],
              appState: docData.appState || {},
              files: docData.files || {},
              ownerName: docData.ownerName || 'Anonymous',
              ownerPhoto: docData.ownerPhoto || '',
            }
          }

          setCanvasData(canvasContent)
        } else {
          setError('Canvas not found')
        }
      } catch (err) {
        console.error('Error loading canvas:', err)
        setError('Failed to load canvas')
      }
      setLoading(false)
    }

    loadCanvas()
  }, [userId, canvasId])

  const cloneCanvas = async () => {
    if (!user || !userId || !canvasId || !canvasData) {
      navigate('/login')
      return
    }

    setCloning(true)

    try {
      // Fetch full canvas content
      const originalRef = doc(db, 'users', userId, 'canvases', canvasId)
      const originalSnap = await getDoc(originalRef)

      if (!originalSnap.exists()) {
        console.error('Original canvas not found')
        setCloning(false)
        return
      }

      const originalData = originalSnap.data()

      // Create a copy in the user's collection
      const userCanvasesRef = collection(db, 'users', user.uid, 'canvases')
      const newCanvasRef = await addDoc(userCanvasesRef, {
        name: `${canvasData.name} (copy)`,
        content: originalData.content,
        preview: originalData.preview,
        forkedFrom: {
          canvasId,
          userId,
          userName: canvasData.ownerName,
          canvasName: canvasData.name,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      navigate(`/canvas/${newCanvasRef.id}`)
    } catch (error) {
      console.error('Error cloning canvas:', error)
    }

    setCloning(false)
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout,
        }}
      >
        <Spin size="large" />
        <Text style={{ marginTop: 16, color: token.colorTextSecondary }}>
          Loading shared canvas...
        </Text>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout,
          gap: 16,
        }}
      >
        <Title level={3} style={{ color: token.colorText }}>
          😕 {error}
        </Title>
        <Button
          type="primary"
          onClick={() => navigate('/gallery')}
          style={{
            background: token.colorPrimary,
            color: token.colorBgContainer,
          }}
        >
          Browse Gallery
        </Button>
      </div>
    )
  }

  return (
    <Layout style={{ height: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: 48,
          lineHeight: '48px',
        }}
      >
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/gallery')}
            className="mobile-icon-only"
            style={{ color: token.colorText }}
          >
            <span className="hide-on-mobile">Gallery</span>
          </Button>
          <Title
            level={5}
            style={{
              margin: 0,
              color: token.colorText,
              maxWidth: 'min(300px, 40vw)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {canvasData?.name || 'Untitled'}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (read-only)
          </Text>
        </Space>

        <Space>
          {canvasData?.ownerPhoto ? (
            <Avatar
              src={
                <img
                  src={canvasData.ownerPhoto}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                />
              }
              size="small"
            />
          ) : (
            <Avatar icon={<UserOutlined />} size="small" />
          )}
          <Text className="hide-on-mobile" type="secondary" style={{ fontSize: 12 }}>
            by {canvasData?.ownerName}
          </Text>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={cloneCanvas}
            loading={cloning}
            style={{
              background: token.colorPrimary,
              color: token.colorBgContainer,
            }}
          >
            <span className="hide-on-mobile">Clone to My Canvases</span>
            <span className="show-on-mobile-only">Clone</span>
          </Button>
        </Space>
      </Header>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Excalidraw
          initialData={{
            elements: canvasData?.elements || [],
            appState: {
              ...canvasData?.appState,
              theme: 'dark',
              viewModeEnabled: true, // Read-only mode
            },
            files: canvasData?.files || {},
          }}
          viewModeEnabled={true}
        />
      </div>
    </Layout>
  )
}
