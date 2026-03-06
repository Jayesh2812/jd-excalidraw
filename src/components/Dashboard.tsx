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
  Empty,
  Row,
  Col,
  Popconfirm,
  message,
  theme,
} from 'antd'
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
  const { token } = theme.useToken()

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
      navigate(`/canvas/${docRef.id}`)
    } catch (error) {
      console.error('Error creating canvas:', error)
      message.error('Failed to create canvas')
    }
    setIsCreating(false)
  }

  const deleteCanvas = async (canvasId: string) => {
    if (!user) return

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'canvases', canvasId))
      message.success('Canvas deleted')
    } catch (error) {
      console.error('Error deleting canvas:', error)
      message.error('Failed to delete canvas')
    }
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
            <Avatar src={user.photoURL} referrerPolicy="no-referrer" />
          ) : (
            <Avatar icon={<UserOutlined />} />
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
        <Space.Compact style={{ width: '100%', marginBottom: 32 }}>
          <Input
            placeholder="Enter canvas name..."
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            onPressEnter={createCanvas}
            style={{ maxWidth: 400 }}
            size="large"
          />
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={createCanvas}
            loading={isCreating}
            disabled={!newCanvasName.trim()}
            style={{
              background: token.colorText,
              color: token.colorBgContainer,
              borderColor: token.colorText,
            }}
          >
            New Canvas
          </Button>
        </Space.Compact>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : canvases.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text style={{ color: token.colorTextSecondary }}>No canvases yet</Text>
                <Text type="secondary">Create your first canvas to start drawing!</Text>
              </Space>
            }
            style={{ padding: 80 }}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {canvases.map((canvas) => (
              <Col xs={24} sm={12} md={8} lg={6} key={canvas.id}>
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
                      }}
                    >
                      <EditOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
                    </div>
                  }
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="Delete canvas"
                      description="Are you sure you want to delete this canvas?"
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        deleteCanvas(canvas.id)
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                      >
                        Delete
                      </Button>
                    </Popconfirm>,
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
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  )
}
