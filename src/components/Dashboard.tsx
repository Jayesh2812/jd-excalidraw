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
  Tooltip,
  Tabs,
  Dropdown,
  Badge,
} from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LogoutOutlined,
  UserOutlined,
  LoadingOutlined,
  ShareAltOutlined,
  StopOutlined,
  GlobalOutlined,
  ForkOutlined,
  FolderOutlined,
  FolderAddOutlined,
  MoreOutlined,
  WifiOutlined,
  StarOutlined,
  StarFilled,
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
import { compressSvg } from '../utils/svgUtils'
import { useOfflineSync } from '../hooks/useOfflineSync'
import {
  saveCanvasOffline,
  saveFolderOffline,
  addPendingOperation,
  isOnline,
} from '../utils/offlineStorage'

const { Header, Content } = Layout
const { Text } = Typography

interface ForkedFrom {
  canvasId: string
  userId: string
  userName: string
  canvasName: string
}

interface Folder {
  id: string
  name: string
  color?: string
  createdAt: any
}

interface Canvas {
  id: string
  name: string
  content?: string  // JSON string of canvas data
  preview?: string  // SVG string for canvas preview
  isShared?: boolean
  sharedAt?: any
  forkedFrom?: ForkedFrom
  folderId?: string | null  // null means root/unfiled
  starred?: boolean
  createdAt: any
  updatedAt: any
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [newCanvasName, setNewCanvasName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<string, string>>({})
  const [generatingIds, setGeneratingIds] = useState<string[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null) // null = All canvases
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const generatingRef = useRef<Set<string>>(new Set())
  const { token } = theme.useToken()
  const { modal, message } = App.useApp()
  
  // Offline sync
  const { isOnline: online, pendingChanges } = useOfflineSync(user?.uid)

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
      const previewElements = elements

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
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as Canvas
        canvasData.push(data)
        // Cache in IndexedDB for offline
        saveCanvasOffline(user.uid, docSnap.id, data).catch(console.error)
      })
      setCanvases(canvasData)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Fetch folders
  useEffect(() => {
    if (!user) return

    const foldersRef = collection(db, 'users', user.uid, 'folders')
    const q = query(foldersRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderData: Folder[] = []
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as Folder
        folderData.push(data)
        // Cache in IndexedDB for offline
        saveFolderOffline(user.uid, docSnap.id, data).catch(console.error)
      })
      setFolders(folderData)
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
      const canvasData = {
        name: newCanvasName.trim(),
        content: JSON.stringify({
          elements: [],
          appState: {},
          files: {},
        }),
        folderId: selectedFolderId, // Add to current folder
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      
      if (isOnline()) {
        const docRef = await addDoc(canvasesRef, canvasData)
        setNewCanvasName('')
        setIsModalOpen(false)
        navigate(`/canvas/${docRef.id}`)
      } else {
        // Offline: create with temp ID and queue for sync
        const tempId = `temp_${Date.now()}`
        await saveCanvasOffline(user.uid, tempId, { ...canvasData, id: tempId }, true)
        await addPendingOperation({
          type: 'create',
          collection: 'canvases',
          docId: tempId,
          data: canvasData,
          userId: user.uid,
        })
        message.info('Canvas created offline. Will sync when online.')
        setNewCanvasName('')
        setIsModalOpen(false)
      }
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

  // Folder management
  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return

    setIsCreatingFolder(true)
    try {
      const foldersRef = collection(db, 'users', user.uid, 'folders')
      await addDoc(foldersRef, {
        name: newFolderName.trim(),
        createdAt: serverTimestamp(),
      })
      setNewFolderName('')
      message.success('Folder created')
    } catch (error) {
      console.error('Error creating folder:', error)
      message.error('Failed to create folder')
    }
    setIsCreatingFolder(false)
  }

  const deleteFolder = async (folderId: string, folderName: string) => {
    if (!user) return

    modal.confirm({
      title: 'Delete folder',
      icon: <ExclamationCircleOutlined />,
      content: `Delete "${folderName}"? Canvases in this folder will be moved to "All Canvases".`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          // Move canvases to root
          const folderCanvases = canvases.filter(c => c.folderId === folderId)
          for (const canvas of folderCanvases) {
            await updateDoc(doc(db, 'users', user.uid, 'canvases', canvas.id), {
              folderId: null,
            })
          }
          // Delete folder
          await deleteDoc(doc(db, 'users', user.uid, 'folders', folderId))
          if (selectedFolderId === folderId) {
            setSelectedFolderId(null)
          }
          message.success('Folder deleted')
        } catch (error) {
          console.error('Error deleting folder:', error)
          message.error('Failed to delete folder')
        }
      },
    })
  }

  const moveCanvasToFolder = async (canvasId: string, folderId: string | null) => {
    if (!user) return

    try {
      await updateDoc(doc(db, 'users', user.uid, 'canvases', canvasId), {
        folderId,
        updatedAt: serverTimestamp(),
      })
      message.success(folderId ? 'Moved to folder' : 'Moved to All Canvases')
    } catch (error) {
      console.error('Error moving canvas:', error)
      message.error('Failed to move canvas')
    }
  }

  // Filter canvases by selected folder or starred
  const filteredCanvases = selectedFolderId === 'starred'
    ? canvases.filter(c => c.starred)
    : selectedFolderId
      ? canvases.filter(c => c.folderId === selectedFolderId)
      : canvases

  const toggleShare = async (canvas: Canvas, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return

    try {
      const docRef = doc(db, 'users', user.uid, 'canvases', canvas.id)
      
      if (canvas.isShared) {
        // Unshare
        await updateDoc(docRef, {
          isShared: false,
          sharedAt: null,
          ownerName: null,
          ownerPhoto: null,
        })
        message.success('Canvas unshared')
      } else {
        // Share
        await updateDoc(docRef, {
          isShared: true,
          sharedAt: serverTimestamp(),
          ownerName: user.displayName || user.email || 'Anonymous',
          ownerPhoto: user.photoURL || '',
        })
        message.success('Canvas shared to gallery!')
      }
    } catch (error) {
      console.error('Error toggling share:', error)
      message.error('Failed to update sharing')
    }
  }

  const toggleStar = async (canvas: Canvas, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return

    try {
      const docRef = doc(db, 'users', user.uid, 'canvases', canvas.id)
      await updateDoc(docRef, {
        starred: !canvas.starred,
      })
    } catch (error) {
      console.error('Error toggling star:', error)
      message.error('Failed to update star')
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
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={28} />
          <Button
            type="text"
            icon={<GlobalOutlined />}
            onClick={() => navigate('/gallery')}
            style={{ color: token.colorTextSecondary, display: 'flex', alignItems: 'center' }}
            className="mobile-icon-only"
          >
            <span className="hide-on-mobile">Gallery</span>
          </Button>
          {/* Offline indicator */}
          {!online && (
            <Tooltip title={pendingChanges > 0 ? `Offline - ${pendingChanges} changes pending sync` : 'You are offline'}>
              <WifiOutlined style={{ fontSize: 16, color: token.colorWarning }} />
            </Tooltip>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <Text className="hide-on-mobile" style={{ color: token.colorText, lineHeight: 1 }}>
            {user?.displayName || user?.email}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={logout}
            style={{ color: token.colorTextSecondary, display: 'flex', alignItems: 'center' }}
            className="mobile-icon-only"
          >
            <span className="hide-on-mobile">Sign Out</span>
          </Button>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Folder Tabs */}
        <div style={{ marginBottom: 16 }}>
          <Tabs
            activeKey={selectedFolderId || 'all'}
            onChange={(key) => setSelectedFolderId(key === 'all' ? null : key)}
            tabBarExtraContent={
              <Input
                placeholder="New folder"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onPressEnter={createFolder}
                prefix={<FolderAddOutlined style={{ color: token.colorTextTertiary }} />}
                suffix={
                  newFolderName.trim() ? (
                    <Button
                      type="text"
                      size="small"
                      loading={isCreatingFolder}
                      onClick={createFolder}
                      style={{ margin: -4, height: 22, width: 22, minWidth: 22 }}
                      icon={<PlusOutlined style={{ fontSize: 12 }} />}
                    />
                  ) : null
                }
                style={{ 
                  width: newFolderName ? 160 : 120,
                  transition: 'width 0.2s ease',
                }}
                size="small"
                variant="filled"
              />
            }
            items={[
              {
                key: 'all',
                label: (
                  <Space size={4}>
                    <FolderOutlined />
                    <span>All Canvases</span>
                    <Badge count={canvases.length} style={{ backgroundColor: token.colorTextTertiary, fontSize: 10, padding: '0 3px' }} />
                  </Space>
                ),
              },
              {
                key: 'starred',
                label: (
                  <Space size={4}>
                    <StarFilled style={{ color: token.colorWarning }} />
                    <span>Starred</span>
                    <Badge 
                      count={canvases.filter((c) => c.starred).length} 
                      style={{ backgroundColor: token.colorTextTertiary, fontSize: 10, padding: '0 3px' }} 
                    />
                  </Space>
                ),
              },
              ...folders.map((folder) => ({
                key: folder.id,
                label: (
                  <Space size={4}>
                    <FolderOutlined />
                    <span>{folder.name}</span>
                    <Badge
                      count={canvases.filter((c) => c.folderId === folder.id).length}
                      style={{ backgroundColor: token.colorTextTertiary, fontSize: 10, padding: '0 3px' }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFolder(folder.id, folder.name)
                      }}
                      style={{ marginLeft: 4, color: token.colorTextTertiary }}
                    />
                  </Space>
                ),
              })),
            ]}
          />
        </div>

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

            {filteredCanvases.map((canvas) => (
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
                          position: 'relative',
                        }}
                      >
                        {/* Forked badge */}
                        {canvas.forkedFrom && (
                          <Tooltip title={`Forked from ${canvas.forkedFrom.userName}`}>
                            <div
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                background: token.colorBgContainer,
                                borderRadius: '50%',
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${token.colorBorder}`,
                                zIndex: 1,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ForkOutlined style={{ fontSize: 16, color: token.colorTextSecondary }} />
                            </div>
                          </Tooltip>
                        )}
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
                      <Tooltip key="star" title={canvas.starred ? 'Unstar' : 'Star'}>
                        <Button
                          type="text"
                          icon={canvas.starred ? <StarFilled style={{ color: token.colorWarning }} /> : <StarOutlined />}
                          onClick={(e) => toggleStar(canvas, e)}
                          size="small"
                        />
                      </Tooltip>,
                      <Button
                        key="share"
                        type="text"
                        icon={canvas.isShared ? <StopOutlined /> : <ShareAltOutlined />}
                        onClick={(e) => toggleShare(canvas, e)}
                        size="small"
                        style={canvas.isShared ? { color: token.colorSuccess } : {}}
                      >
                        {canvas.isShared ? 'Shared' : 'Share'}
                      </Button>,
                      <Dropdown
                        key="more"
                        trigger={['click']}
                        menu={{
                          items: [
                            {
                              key: 'move',
                              label: 'Move to folder',
                              icon: <FolderOutlined />,
                              children: [
                                {
                                  key: 'move-root',
                                  label: 'All Canvases',
                                  onClick: () => moveCanvasToFolder(canvas.id, null),
                                  disabled: !canvas.folderId,
                                },
                                ...folders.map((folder) => ({
                                  key: `move-${folder.id}`,
                                  label: folder.name,
                                  onClick: () => moveCanvasToFolder(canvas.id, folder.id),
                                  disabled: canvas.folderId === folder.id,
                                })),
                              ],
                            },
                            { type: 'divider' as const },
                            {
                              key: 'delete',
                              label: 'Delete',
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => {
                                modal.confirm({
                                  title: 'Delete canvas',
                                  icon: <ExclamationCircleOutlined />,
                                  content: `Are you sure you want to delete "${canvas.name}"?`,
                                  okText: 'Delete',
                                  okType: 'danger',
                                  cancelText: 'Cancel',
                                  centered: true,
                                  onOk: async () => {
                                    try {
                                      await deleteDoc(doc(db, 'users', user!.uid, 'canvases', canvas.id))
                                      message.success('Canvas deleted')
                                    } catch (error) {
                                      console.error('Error deleting canvas:', error)
                                      message.error('Failed to delete canvas')
                                    }
                                  },
                                })
                              },
                            },
                          ],
                        }}
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                      </Dropdown>,
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
