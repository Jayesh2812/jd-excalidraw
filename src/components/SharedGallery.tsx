import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  Typography,
  Card,
  Avatar,
  Space,
  Spin,
  Row,
  Col,
  Empty,
  Button,
  theme,
  App,
} from 'antd'
import {
  EyeOutlined,
  CopyOutlined,
  UserOutlined,
  HomeOutlined,
  EditOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import {
  collectionGroup,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { Logo } from './Logo'
import { TiltCard } from './TiltCard'
import { AnimatedBackground } from './AnimatedBackground'

const { Header, Content } = Layout
const { Title, Text } = Typography

interface SharedCanvas {
  id: string
  userId: string
  userName: string
  userPhoto: string
  name: string
  preview?: string
  sharedAt: any
}

export function SharedGallery() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sharedCanvases, setSharedCanvases] = useState<SharedCanvas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cloning, setCloning] = useState<string | null>(null)
  const { token } = theme.useToken()
  const { modal } = App.useApp()

  useEffect(() => {
    // Query all canvases where isShared = true across all users
    const sharedQuery = query(
      collectionGroup(db, 'canvases'),
      where('isShared', '==', true),
      orderBy('sharedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      sharedQuery,
      (snapshot) => {
        const canvases: SharedCanvas[] = []
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data()
          // Extract userId from the document path
          const pathParts = docSnap.ref.path.split('/')
          const userId = pathParts[1] // users/{userId}/canvases/{canvasId}
          
          canvases.push({
            id: docSnap.id,
            userId,
            userName: data.ownerName || 'Anonymous',
            userPhoto: data.ownerPhoto || '',
            name: data.name,
            preview: data.preview,
            sharedAt: data.sharedAt,
          })
        }
        
        setSharedCanvases(canvases)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching shared canvases:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  const performClone = async (canvas: SharedCanvas) => {
    if (!user) {
      navigate('/login')
      return
    }

    setCloning(canvas.id)
    
    try {
      // Fetch the original canvas content
      const originalRef = doc(db, 'users', canvas.userId, 'canvases', canvas.id)
      const originalSnap = await getDoc(originalRef)
      
      if (!originalSnap.exists()) {
        console.error('Original canvas not found')
        setCloning(null)
        return
      }

      const originalData = originalSnap.data()

      // Create a copy in the user's collection
      const userCanvasesRef = collection(db, 'users', user.uid, 'canvases')
      const newCanvasRef = await addDoc(userCanvasesRef, {
        name: `${canvas.name} (copy)`,
        content: originalData.content,
        preview: originalData.preview,
        // Reference to original
        forkedFrom: {
          canvasId: canvas.id,
          userId: canvas.userId,
          userName: canvas.userName,
          canvasName: canvas.name,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Navigate to the new canvas
      navigate(`/canvas/${newCanvasRef.id}`)
    } catch (error) {
      console.error('Error cloning canvas:', error)
    }
    
    setCloning(null)
  }

  const confirmClone = (canvas: SharedCanvas) => {
    modal.confirm({
      title: 'Clone canvas',
      icon: <QuestionCircleOutlined />,
      content: `Clone "${canvas.name}" by ${canvas.userName} to your canvases?`,
      okText: 'Clone',
      cancelText: 'Cancel',
      centered: true,
      onOk: () => performClone(canvas),
    })
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recently'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <AnimatedBackground />
      <Header
        style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(20, 20, 20, 0.95) 50%, rgba(20, 20, 20, 0.98) 100%)',
          borderBottom: `1px solid rgba(168, 85, 247, 0.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Space>
          <Logo size={28} />
          <Title level={5} style={{ margin: 0, color: token.colorTextSecondary }}>
            / Gallery
          </Title>
        </Space>
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => navigate('/')}
          style={{ color: token.colorText }}
        >
          <span className="hide-on-mobile">My Canvases</span>
        </Button>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ color: token.colorText, margin: 0 }}>
            Shared Gallery
          </Title>
          <Text type="secondary">
            Browse canvases shared by the community
          </Text>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Empty
            description={
              <Space direction="vertical">
                <Text type="danger">Failed to load shared canvases</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {error.includes('index') 
                    ? 'A Firestore index is required. Check the browser console for a link to create it.'
                    : error}
                </Text>
              </Space>
            }
          />
        ) : sharedCanvases.length === 0 ? (
          <Empty
            description={
              <Text type="secondary">
                No shared canvases yet. Be the first to share!
              </Text>
            }
          />
        ) : (
          <Row gutter={[16, 16]}>
            {sharedCanvases.map((canvas) => (
              <Col xs={24} sm={12} md={8} lg={6} key={`${canvas.userId}-${canvas.id}`}>
                <TiltCard>
                  <Card
                    hoverable
                    style={{
                      background: token.colorBgContainer,
                      borderColor: token.colorBorder,
                    }}
                    styles={{
                      body: { padding: 12 },
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
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          // If own canvas, go to edit mode
                          if (canvas.userId === user?.uid) {
                            navigate(`/canvas/${canvas.id}`)
                          } else {
                            navigate(`/shared/${canvas.userId}/${canvas.id}`)
                          }
                        }}
                      >
                        {canvas.preview ? (
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
                            dangerouslySetInnerHTML={{ __html: canvas.preview }}
                          />
                        ) : (
                          <EyeOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
                        )}
                      </div>
                    }
                    actions={
                      canvas.userId === user?.uid
                        ? [
                            <Button
                              key="edit"
                              type="text"
                              icon={<EditOutlined />}
                              onClick={() => navigate(`/canvas/${canvas.id}`)}
                              size="small"
                            >
                              Edit
                            </Button>,
                          ]
                        : [
                            <Button
                              key="view"
                              type="text"
                              icon={<EyeOutlined />}
                              onClick={() => navigate(`/shared/${canvas.userId}/${canvas.id}`)}
                              size="small"
                            >
                              View
                            </Button>,
                            <Button
                              key="clone"
                              type="text"
                              icon={<CopyOutlined />}
                              onClick={() => confirmClone(canvas)}
                              loading={cloning === canvas.id}
                              size="small"
                            >
                              Clone
                            </Button>,
                          ]
                    }
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ color: token.colorText }}>
                          {canvas.name}
                        </Text>
                      }
                      description={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {canvas.userPhoto ? (
                            <Avatar
                              src={
                                <img
                                  src={canvas.userPhoto}
                                  alt="avatar"
                                  referrerPolicy="no-referrer"
                                />
                              }
                              size={18}
                            />
                          ) : (
                            <Avatar icon={<UserOutlined />} size={18} />
                          )}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {canvas.userId === user?.uid ? 'You' : canvas.userName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            · {formatDate(canvas.sharedAt)}
                          </Text>
                        </div>
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
