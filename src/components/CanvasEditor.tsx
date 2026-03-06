import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Button, Typography, Spin, Space, Input, theme } from 'antd'
import {
  ArrowLeftOutlined,
  HistoryOutlined,
  LoadingOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { Excalidraw, exportToSvg } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { VersionHistory, SaveVersionButton } from './VersionHistory'
import { convertElementColorsForPreview } from '../utils/colorUtils'
import { compressSvg } from '../utils/svgUtils'

const { Header } = Layout
const { Title, Text } = Typography

interface CanvasData {
  name: string
  elements: readonly any[]
  appState: any
  files: any
}

// Hybrid throttle + debounce configuration
const THROTTLE_INTERVAL = 3000  // Maximum time between saves while actively working
const DEBOUNCE_DELAY = 800      // Save quickly after user stops making changes

export function CanvasEditor() {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [isVersionSidebarOpen, setIsVersionSidebarOpen] = useState(false)
  const [excalidrawKey, setExcalidrawKey] = useState(0)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const { token } = theme.useToken()
  
  // Excalidraw API ref for generating previews
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  
  // Refs for hybrid throttle + debounce
  const lastSavedHashRef = useRef<string>('')
  const pendingStateRef = useRef<string | null>(null)
  const currentContentRef = useRef<string>('')
  const lastSaveTimeRef = useRef<number>(0)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasUnsavedChangesRef = useRef<boolean>(false)

  // Extract saveable state
  const getSaveableState = (elements: readonly any[], appState: any, files: any) => {
    const {
      collaborators,
      followedBy,
      cursorButton,
      scrollX,
      scrollY,
      selectedElementIds,
      selectedGroupIds,
      editingGroupId,
      editingElement,
      resizingElement,
      selectionElement,
      draggingElement,
      isBindingEnabled,
      ...saveableAppState
    } = appState

    return {
      elements,
      appState: saveableAppState,
      files: files || {},
    }
  }

  // Generate SVG preview from current canvas state
  const generatePreview = useCallback(async (): Promise<string | null> => {
    const api = excalidrawAPIRef.current
    if (!api) return null

    try {
      // Get only non-deleted elements
      const allElements = api.getSceneElements()
      const elements = allElements.filter((el: any) => !el.isDeleted)
      const files = api.getFiles()
      
      // Skip preview generation if canvas is empty
      if (!elements || elements.length === 0) return null

      // Convert dark colors to light for preview visibility
      const previewElements = elements.map(convertElementColorsForPreview)

      const svg = await exportToSvg({
        elements: previewElements,
        appState: {
          exportBackground: false,
          exportPadding: 10,
        },
        files,
      })

      // Serialize and compress SVG
      const svgString = new XMLSerializer().serializeToString(svg)
      return compressSvg(svgString)
    } catch (err) {
      console.error('Error generating preview:', err)
      return null
    }
  }, [])

  // Save preview to Firestore (called less frequently than content save)
  const savePreview = useCallback(async () => {
    if (!user || !canvasId) return
    
    try {
      const preview = await generatePreview()
      if (preview) {
        const docRef = doc(db, 'users', user.uid, 'canvases', canvasId)
        await updateDoc(docRef, { preview })
      }
    } catch (err) {
      console.error('Error saving preview:', err)
    }
  }, [user, canvasId, generatePreview])

  // Ref for preview debounce
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PREVIEW_DEBOUNCE_DELAY = 10000 // 10 seconds - much less frequent than content save

  // Actual save function (content only, preview saved separately)
  const performSave = useCallback(async (stateHash: string) => {
    if (!user || !canvasId) return

    setSaveStatus('saving')
    
    try {
      const docRef = doc(db, 'users', user.uid, 'canvases', canvasId)
      
      await updateDoc(docRef, {
        content: stateHash,
        updatedAt: serverTimestamp(),
      })
      
      lastSavedHashRef.current = stateHash
      lastSaveTimeRef.current = Date.now()
      hasUnsavedChangesRef.current = false
      pendingStateRef.current = null
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Schedule preview save with longer debounce
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
      previewDebounceRef.current = setTimeout(() => {
        savePreview()
      }, PREVIEW_DEBOUNCE_DELAY)
    } catch (err) {
      console.error('Error saving canvas:', err)
      setSaveStatus('idle')
    }
  }, [user, canvasId, savePreview])

  // Hybrid throttle + debounce save strategy
  const saveCanvas = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      if (!user || !canvasId) return

      const saveableState = getSaveableState(elements, appState, files)
      const stateHash = JSON.stringify(saveableState)
      
      currentContentRef.current = stateHash
      
      if (stateHash === lastSavedHashRef.current) {
        return
      }

      hasUnsavedChangesRef.current = true
      pendingStateRef.current = stateHash
      setSaveStatus('saving')

      const now = Date.now()
      const timeSinceLastSave = now - lastSaveTimeRef.current

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      if (timeSinceLastSave >= THROTTLE_INTERVAL) {
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current)
          throttleTimeoutRef.current = null
        }
        performSave(stateHash)
        return
      }

      debounceTimeoutRef.current = setTimeout(() => {
        if (pendingStateRef.current && hasUnsavedChangesRef.current) {
          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
            throttleTimeoutRef.current = null
          }
          performSave(pendingStateRef.current)
        }
      }, DEBOUNCE_DELAY)

      if (!throttleTimeoutRef.current) {
        const remainingThrottleTime = THROTTLE_INTERVAL - timeSinceLastSave
        throttleTimeoutRef.current = setTimeout(() => {
          throttleTimeoutRef.current = null
          if (pendingStateRef.current && hasUnsavedChangesRef.current) {
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current)
              debounceTimeoutRef.current = null
            }
            performSave(pendingStateRef.current)
          }
        }, remainingThrottleTime)
      }
    },
    [user, canvasId, performSave]
  )

  // Load canvas data
  useEffect(() => {
    if (!user || !canvasId) return

    const loadCanvas = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'canvases', canvasId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const docData = docSnap.data()
          
          let canvasContent: CanvasData
          if (docData.content) {
            const parsed = JSON.parse(docData.content)
            canvasContent = {
              name: docData.name,
              elements: parsed.elements || [],
              appState: parsed.appState || {},
              files: parsed.files || {},
            }
          } else {
            canvasContent = {
              name: docData.name,
              elements: docData.elements || [],
              appState: docData.appState || {},
              files: docData.files || {},
            }
          }
          
          setCanvasData(canvasContent)
          const contentHash = JSON.stringify({
            elements: canvasContent.elements,
            appState: canvasContent.appState,
            files: canvasContent.files,
          })
          lastSavedHashRef.current = contentHash
          currentContentRef.current = contentHash
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
  }, [user, canvasId])

  // Warn before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
      if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current)
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
      if (pendingStateRef.current && hasUnsavedChangesRef.current) {
        performSave(pendingStateRef.current)
      }
      // Save preview on unmount
      savePreview()
    }
  }, [performSave, savePreview])

  const handleBack = useCallback(async () => {
    if (hasUnsavedChangesRef.current) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!confirmed) return
    }
    // Save preview before navigating away
    await savePreview()
    navigate('/')
  }, [navigate, savePreview])

  const handleRestoreVersion = useCallback(async (content: string) => {
    try {
      const parsed = JSON.parse(content)
      
      setCanvasData(prev => ({
        name: prev?.name || 'Untitled',
        elements: parsed.elements || [],
        appState: parsed.appState || {},
        files: parsed.files || {},
      }))
      
      lastSavedHashRef.current = content
      currentContentRef.current = content
      hasUnsavedChangesRef.current = false
      
      setExcalidrawKey(prev => prev + 1)
      
      if (user && canvasId) {
        const docRef = doc(db, 'users', user.uid, 'canvases', canvasId)
        await updateDoc(docRef, {
          content: content,
          updatedAt: serverTimestamp(),
        })
      }
      
      setIsVersionSidebarOpen(false)
    } catch (err) {
      console.error('Error restoring version:', err)
    }
  }, [user, canvasId])

  const toggleVersionSidebar = useCallback(() => {
    setIsVersionSidebarOpen(prev => !prev)
  }, [])

  // Start editing canvas name
  const startEditingName = useCallback(() => {
    setEditedName(canvasData?.name || '')
    setIsEditingName(true)
  }, [canvasData?.name])

  // Save canvas name
  const saveCanvasName = useCallback(async () => {
    if (!user || !canvasId || !editedName.trim()) {
      setIsEditingName(false)
      return
    }

    const newName = editedName.trim()
    if (newName === canvasData?.name) {
      setIsEditingName(false)
      return
    }

    try {
      const docRef = doc(db, 'users', user.uid, 'canvases', canvasId)
      await updateDoc(docRef, {
        name: newName,
        updatedAt: serverTimestamp(),
      })
      setCanvasData(prev => prev ? { ...prev, name: newName } : null)
    } catch (err) {
      console.error('Error saving canvas name:', err)
    }
    setIsEditingName(false)
  }, [user, canvasId, editedName, canvasData?.name])

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
          Loading canvas...
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
          onClick={() => navigate('/')}
          style={{
            background: token.colorText,
            color: token.colorBgContainer,
          }}
        >
          Back to Dashboard
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
            onClick={handleBack}
            style={{ color: token.colorText }}
          >
            Back
          </Button>
          {isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onPressEnter={saveCanvasName}
              onBlur={saveCanvasName}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditingName(false)
                }
              }}
              autoFocus
              variant="borderless"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: token.colorText,
                padding: '0 4px',
                width: 200,
                background: token.colorBgElevated,
                borderRadius: token.borderRadius,
              }}
            />
          ) : (
            <Title
              level={5}
              onClick={startEditingName}
              style={{
                margin: 0,
                color: token.colorText,
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {canvasData?.name || 'Untitled'}
            </Title>
          )}
        </Space>

        <Space>
          {saveStatus === 'saving' && (
            <Space style={{ color: token.colorTextSecondary }}>
              <LoadingOutlined />
              <Text style={{ color: token.colorTextSecondary }}>Saving...</Text>
            </Space>
          )}
          {saveStatus === 'saved' && (
            <Space style={{ color: token.colorSuccess }}>
              <CheckOutlined />
              <Text style={{ color: token.colorSuccess }}>Saved</Text>
            </Space>
          )}
          <Button
            type={isVersionSidebarOpen ? 'primary' : 'text'}
            icon={<HistoryOutlined />}
            onClick={toggleVersionSidebar}
            style={isVersionSidebarOpen ? {
              background: token.colorText,
              color: token.colorBgContainer,
            } : {
              color: token.colorText,
            }}
          >
            History
          </Button>
        </Space>
      </Header>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Excalidraw
          key={excalidrawKey}
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api
          }}
          initialData={{
            elements: canvasData?.elements || [],
            appState: {
              ...canvasData?.appState,
              theme: 'dark',
            },
            files: canvasData?.files || {},
          }}
          onChange={(elements, appState, files) => {
            saveCanvas(elements, appState, files)
          }}
        />

        {/* Floating Save Version Button */}
        <div style={{ 
          position: 'absolute', 
          bottom: 24, 
          right: isVersionSidebarOpen ? 324 : 24,
          transition: 'right 0.3s ease',
        }}>
          <SaveVersionButton onClick={toggleVersionSidebar} />
        </div>

        {/* Version History Sidebar */}
        {user && canvasId && (
          <VersionHistory
            userId={user.uid}
            canvasId={canvasId}
            currentContent={currentContentRef.current}
            isOpen={isVersionSidebarOpen}
            onClose={() => setIsVersionSidebarOpen(false)}
            onRestore={handleRestoreVersion}
          />
        )}
      </div>
    </Layout>
  )
}
