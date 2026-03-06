import { useEffect, useState } from 'react'
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
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { Logo } from './Logo'
import { TiltCard } from './TiltCard'

const { Header, Content } = Layout
const { Text } = Typography

interface Canvas {
  id: string
  name: string
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
  const { token } = theme.useToken()
  const { modal, message } = App.useApp()

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
        <Space>
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
          <Text style={{ color: token.colorText }}>
            {user?.displayName || user?.email}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={logout}
            style={{ color: token.colorTextSecondary }}
          >
            Sign Out
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
                <TiltCard onClick={() => navigate(`/canvas/${canvas.id}`)}>
                  <Card
                    hoverable
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
                        }}
                      >
                        <EditOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
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
