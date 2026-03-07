import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  Typography,
  Button,
  Input,
  Card,
  Avatar,
  Space,
  Spin,
  Row,
  Col,
  App,
  theme,
} from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LogoutOutlined,
  UserOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { exportToSvg } from '@excalidraw/excalidraw'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { Logo } from './Logo'
import { TiltCard } from './TiltCard'
import { convertElementColorsForPreview } from '../utils/colorUtils'
import { compressSvg } from '../utils/svgUtils'

const { Header, Content } = Layout
const { Text } = Typography

interface Canvas {
  id: string
  name: string
  content?: string  // JSON string of canvas data
  preview?: string  // SVG string for canvas preview
  createdAt: any
  updatedAt: any
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [loading, setLoading] = useState(true)
  const [newCanvasName, setNewCanvasName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<string, string>>({})
  const [generatingIds, setGeneratingIds] = useState<string[]>([])
  const generatingRef = useRef<Set<string>>(new Set())
  const { token } = theme.useToken()
  const { modal, message } = App.useApp()

  // Generate preview for a canvas that doesn't have one
  const generatePreviewForCanvas = useCallback(async (canvas: Canvas) => {
    if (!user || !canvas.content) return
    if (generatingRef.current.has(canvas.id)) return

    try {
      const parsed = JSON.parse(canvas.content)
      const elements = parsed.elements || []
      
      // Skip if no elements
      if (elements.length === 0) return

      generatingRef.current.add(canvas.id)
      setGeneratingIds(Array.from(generatingRef.current))

      // Convert dark colors to light for preview visibility
      const previewElements = elements.map(convertElementColorsForPreview)

      const svg = await exportToSvg({
        elements: previewElements,
        appState: {
          exportBackground: false,
          exportPadding: 10,
        },
        files: parsed.files || {},
      })

      // Serialize and compress SVG
      const svgString = compressSvg(new XMLSerializer().serializeToString(svg))
      
      // Store in local state for immediate display
      setGeneratedPreviews(prev => ({ ...prev, [canvas.id]: svgString }))

      // Also save to Firestore for future use
      const docRef = doc(db, 'users', user.uid, 'canvases', canvas.id)
      await updateDoc(docRef, { preview: svgString })
    } catch (err) {
      console.error('Error generating preview:', err)
    } finally {
      generatingRef.current.delete(canvas.id)
      setGeneratingIds(Array.from(generatingRef.current))
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const canvasesRef = collection(db, 'users', user.uid, 'canvases')
    const q = query(canvasesRef, orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const canvasData: Canvas[] = []
      snapshot.forEach((doc) => {
        canvasData.push({ id: doc.id, ...doc.data() } as Canvas)
      })
      setCanvases(canvasData)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Generate previews for canvases that don't have them
  useEffect(() => {
    canvases.forEach(canvas => {
      if (!canvas.preview && !generatedPreviews[canvas.id] && canvas.content) {
        generatePreviewForCanvas(canvas)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvases])

  const createCanvas = async () => {
    if (!user || !newCanvasName.trim()) return

    setIsCreating(true)
    try {
      const canvasesRef = collection(db, 'users', user.uid, 'canvases')
      const docRef = await addDoc(canvasesRef, {
        name: newCanvasName.trim(),
        content: JSON.stringify({
          elements: [],
          appState: {},
          files: {},
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNewCanvasName('')
      setIsModalOpen(false)
      navigate(`/canvas/${docRef.id}`)
    } catch (error) {
      console.error('Error creating canvas:', error)
      message.error('Failed to create canvas')
    }
    setIsCreating(false)
  }

  const openCreateModal = () => {
    setNewCanvasName('')
    setIsModalOpen(true)
  }

  const confirmDeleteCanvas = (canvasId: string, canvasName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return

    modal.confirm({
      title: 'Delete canvas',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${canvasName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'canvases', canvasId))
          message.success('Canvas deleted')
        } catch (error) {
          console.error('Error deleting canvas:', error)
          message.error('Failed to delete canvas')
        }
      },
    })
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
<Logo size={28} />
        <Space size="small">
          {user?.photoURL ? (
            <Avatar
              src={
                <img
                  src={user.photoURL}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              }
            />
          ) : (
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#303030' }} />
          )}
          <Text className="hide-on-mobile" style={{ color: token.colorText }}>
            {user?.displayName || user?.email}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={logout}
            style={{ color: token.colorTextSecondary }}
            className="mobile-icon-only"
          >
            <span className="hide-on-mobile">Sign Out</span>
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {/* Add New Canvas Card */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable={!isModalOpen}
                onClick={!isModalOpen ? openCreateModal : undefined}
                style={{
                  background: isModalOpen ? token.colorBgContainer : 'transparent',
                  borderColor: token.colorBorder,
                  borderStyle: isModalOpen ? 'solid' : 'dashed',
                }}
                styles={{
                  body: { padding: 16 },
                }}
                cover={
                  <div
                    style={{
                      height: 120,
                      background: isModalOpen ? token.colorBgElevated : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: `1px ${isModalOpen ? 'solid' : 'dashed'} ${token.colorBorder}`,
                    }}
                  >
                    <PlusOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
                  </div>
                }
                actions={
                  isModalOpen
                    ? [
                        <Button
                          key="cancel"
                          type="text"
                          onClick={() => setIsModalOpen(false)}
                          size="small"
                        >
                          Cancel
                        </Button>,
                        <Button
                          key="create"
                          type="text"
                          onClick={createCanvas}
                          loading={isCreating}
                          disabled={!newCanvasName.trim()}
                          size="small"
                          style={
                            newCanvasName.trim()
                              ? { color: token.colorText, fontWeight: 500 }
                              : {}
                          }
                        >
                          Create
                        </Button>,
                      ]
                    : [
                        <Text key="hint" type="secondary" style={{ fontSize: 12 }}>
                          Click to add
                        </Text>,
                      ]
                }
              >
                <Card.Meta
                  title={
                    isModalOpen ? (
                      <Input
                        placeholder="Enter canvas name..."
                        value={newCanvasName}
                        onChange={(e) => setNewCanvasName(e.target.value)}
                        onPressEnter={createCanvas}
                        onKeyDown={(e) => e.key === 'Escape' && setIsModalOpen(false)}
                        autoFocus
                        variant="borderless"
                        style={{
                          padding: 0,
                          fontSize: 14,
                          fontWeight: 500,
                          color: token.colorText,
                          height: 22,
                        }}
                      />
                    ) : (
                      <Text style={{ color: token.colorTextSecondary }}>
                        New Canvas
                      </Text>
                    )
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {isModalOpen ? "Whenever you're ready, press ENTER" : '\u00A0'}
                    </Text>
                  }
                />
              </Card>
            </Col>

            {canvases.map((canvas) => (
              <Col xs={24} sm={12} md={8} lg={6} key={canvas.id}>
                <TiltCard>
                  <Card
                    hoverable
                    onClick={() => navigate(`/canvas/${canvas.id}`)}
                    style={{
                      background: token.colorBgContainer,
                      borderColor: token.colorBorder,
                    }}
                    styles={{
                      body: { padding: 16 },
                    }}
                    cover={
                      <div
                        style={{
                          height: 120,
                          background: token.colorBgElevated,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderBottom: `1px solid ${token.colorBorder}`,
                          overflow: 'hidden',
                        }}
                      >
                        {(() => {
                          const previewSvg = canvas.preview || generatedPreviews[canvas.id]
                          const isGenerating = generatingIds.includes(canvas.id)
                          
                          if (previewSvg) {
                            return (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 4,
                                  pointerEvents: 'none',
                                  overflow: 'hidden',
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: previewSvg,
                                }}
                              />
                            )
                          }
                          
                          if (isGenerating) {
                            return <LoadingOutlined style={{ fontSize: 24, color: token.colorTextTertiary }} />
                          }
                          
                          return <EditOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
                        })()}
                      </div>
                    }
                    actions={[
                      <Button
                        key="delete"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmDeleteCanvas(canvas.id, canvas.name, e)
                        }}
                        size="small"
                      >
                        Delete
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ color: token.colorText }}>
                          {canvas.name}
                        </Text>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDate(canvas.updatedAt)}
                        </Text>
                      }
                    />
                  </Card>
                </TiltCard>
              </Col>
            ))}
          </Row>
        )}
      </Content>

    </Layout>
  )
}
