import { useEffect, useState } from 'react'
import {
  Drawer,
  Typography,
  Button,
  Input,
  List,
  Space,
  Spin,
  Empty,
  Tooltip,
  theme,
  Flex,
} from 'antd'
import {
  SaveOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  HistoryOutlined,
  PushpinOutlined,
} from '@ant-design/icons'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const { Title, Text } = Typography

interface Version {
  id: string
  name: string
  content: string
  createdAt: any
}

interface VersionHistoryProps {
  userId: string
  canvasId: string
  currentContent: string
  isOpen: boolean
  onClose: () => void
  onRestore: (content: string) => void
}

export function VersionHistory({
  userId,
  canvasId,
  currentContent,
  isOpen,
  onClose,
  onRestore,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const { token } = theme.useToken()

  useEffect(() => {
    if (!userId || !canvasId) return

    const versionsRef = collection(db, 'users', userId, 'canvases', canvasId, 'versions')
    const q = query(versionsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const versionData: Version[] = []
      snapshot.forEach((doc) => {
        versionData.push({ id: doc.id, ...doc.data() } as Version)
      })
      setVersions(versionData)
      setLoading(false)
    })

    return unsubscribe
  }, [userId, canvasId])

  const saveVersion = async (name?: string) => {
    if (!userId || !canvasId || !currentContent) return

    setSaving(true)
    try {
      const versionsRef = collection(db, 'users', userId, 'canvases', canvasId, 'versions')
      await addDoc(versionsRef, {
        name: name?.trim() || '',
        content: currentContent,
        createdAt: serverTimestamp(),
      })
      setVersionName('')
      setShowNameInput(false)
    } catch (error) {
      console.error('Error saving version:', error)
    }
    setSaving(false)
  }

  const handleSaveClick = () => {
    if (showNameInput) {
      saveVersion(versionName)
    } else {
      setShowNameInput(true)
    }
  }

  const handleQuickSave = () => {
    saveVersion()
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

  const handleRestore = (version: Version) => {
    if (window.confirm(`Restore "${version.name || formatDate(version.createdAt)}"? Your current work will be replaced.`)) {
      onRestore(version.content)
    }
  }

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>Version History</span>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={isOpen}
      width={300}
      closeIcon={<CloseOutlined style={{ color: token.colorText }} />}
      styles={{
        header: {
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
        },
        body: {
          background: token.colorBgContainer,
          padding: 16,
        },
      }}
    >
      {/* Save Section */}
      <div style={{ marginBottom: 24 }}>
        {showNameInput ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="Version name (optional)"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              onPressEnter={() => saveVersion(versionName)}
              autoFocus
            />
            <Space style={{ width: '100%' }}>
              <Button
                type="primary"
                onClick={() => saveVersion(versionName)}
                loading={saving}
                style={{
                  background: token.colorText,
                  color: token.colorBgContainer,
                }}
              >
                Save
              </Button>
              <Button onClick={() => setShowNameInput(false)}>
                Cancel
              </Button>
            </Space>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveClick}
              disabled={saving}
              block
              style={{
                background: token.colorBgElevated,
                borderColor: token.colorBorder,
                color: token.colorText,
              }}
            >
              Save with Name
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleQuickSave}
              disabled={saving}
              loading={saving}
              block
              type="primary"
              style={{
                background: token.colorText,
                color: token.colorBgContainer,
              }}
            >
              Quick Save
            </Button>
          </Space>
        )}
      </div>

      {/* Versions List */}
      {loading ? (
        <Flex justify="center" align="center" style={{ padding: 40 }}>
          <Spin />
        </Flex>
      ) : versions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical">
              <Text type="secondary">No versions saved yet</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Click "Quick Save" to create a checkpoint
              </Text>
            </Space>
          }
        />
      ) : (
        <List
          dataSource={versions}
          renderItem={(version) => (
            <List.Item
              onClick={() => handleRestore(version)}
              style={{
                cursor: 'pointer',
                padding: '12px 8px',
                borderRadius: token.borderRadius,
                marginBottom: 4,
                border: `1px solid ${token.colorBorder}`,
                background: token.colorBgElevated,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = token.colorBgSpotlight
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = token.colorBgElevated
              }}
            >
              <List.Item.Meta
                title={
                  <Text style={{ color: token.colorText }}>
                    {version.name || 'Untitled version'}
                  </Text>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDate(version.createdAt)}
                  </Text>
                }
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Restore →
              </Text>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  )
}

// Floating Save Version Button Component
interface SaveVersionButtonProps {
  onClick: () => void
}

export function SaveVersionButton({ onClick }: SaveVersionButtonProps) {
  const { token } = theme.useToken()

  return (
    <Tooltip title="Save Version" placement="left">
      <Button
        type="primary"
        shape="round"
        size="large"
        icon={<PushpinOutlined />}
        onClick={onClick}
        style={{
          background: token.colorText,
          color: token.colorBgContainer,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        Save Version
      </Button>
    </Tooltip>
  )
}
