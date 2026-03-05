import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import './CanvasEditor.css'

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
  
  // Refs for hybrid throttle + debounce
  const lastSavedHashRef = useRef<string>('')
  const pendingStateRef = useRef<string | null>(null)
  const lastSaveTimeRef = useRef<number>(0)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasUnsavedChangesRef = useRef<boolean>(false)

  // Extract saveable state (excluding transient properties like cursor, selection)
  const getSaveableState = (elements: readonly any[], appState: any, files: any) => {
    const {
      // Exclude transient/non-serializable fields
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
      ...saveableAppState
    } = appState

    return {
      elements,
      appState: saveableAppState,
      files: files || {},
    }
  }

  // Actual save function
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
    } catch (err) {
      console.error('Error saving canvas:', err)
      setSaveStatus('idle')
    }
  }, [user, canvasId])

  // Hybrid throttle + debounce save strategy
  // - Debounce: Save quickly (800ms) after user stops making changes
  // - Throttle: Guarantee saves every 3s while actively working (prevents data loss)
  const saveCanvas = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      if (!user || !canvasId) return

      // Get saveable state (excludes transient properties)
      const saveableState = getSaveableState(elements, appState, files)
      const stateHash = JSON.stringify(saveableState)
      
      // Check if there are actual changes worth saving
      if (stateHash === lastSavedHashRef.current) {
        return // No meaningful changes, skip save
      }

      // Mark as having unsaved changes
      hasUnsavedChangesRef.current = true
      pendingStateRef.current = stateHash
      setSaveStatus('saving')

      const now = Date.now()
      const timeSinceLastSave = now - lastSaveTimeRef.current

      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // If throttle interval has passed, save immediately
      if (timeSinceLastSave >= THROTTLE_INTERVAL) {
        // Clear throttle timeout since we're saving now
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current)
          throttleTimeoutRef.current = null
        }
        performSave(stateHash)
        return
      }

      // Set up debounce - save after user stops making changes
      debounceTimeoutRef.current = setTimeout(() => {
        if (pendingStateRef.current && hasUnsavedChangesRef.current) {
          // Clear throttle timeout since debounce is saving
          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
            throttleTimeoutRef.current = null
          }
          performSave(pendingStateRef.current)
        }
      }, DEBOUNCE_DELAY)

      // Set up throttle fallback - ensure we save even if user keeps making changes
      // Only set if not already set
      if (!throttleTimeoutRef.current) {
        const remainingThrottleTime = THROTTLE_INTERVAL - timeSinceLastSave
        throttleTimeoutRef.current = setTimeout(() => {
          throttleTimeoutRef.current = null
          if (pendingStateRef.current && hasUnsavedChangesRef.current) {
            // Clear debounce since throttle is saving
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
          
          // Parse content from JSON string if it exists, otherwise use legacy format
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
            // Legacy format (direct fields)
            canvasContent = {
              name: docData.name,
              elements: docData.elements || [],
              appState: docData.appState || {},
              files: docData.files || {},
            }
          }
          
          setCanvasData(canvasContent)
          // Initialize last saved reference to prevent immediate re-save
          lastSavedHashRef.current = JSON.stringify({
            elements: canvasContent.elements,
            appState: canvasContent.appState,
            files: canvasContent.files,
          })
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

  // Warn user before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault()
        // Modern browsers require returnValue to be set
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Cleanup and save pending changes on unmount
  useEffect(() => {
    return () => {
      // Clear both timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
      // Try to save any pending changes before unmount
      if (pendingStateRef.current && hasUnsavedChangesRef.current) {
        // Note: This is best-effort, async operations may not complete
        performSave(pendingStateRef.current)
      }
    }
  }, [performSave])

  // Handle back navigation with unsaved changes warning
  const handleBack = useCallback(() => {
    if (hasUnsavedChangesRef.current) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!confirmed) return
    }
    navigate('/')
  }, [navigate])

  if (loading) {
    return (
      <div className="canvas-editor-loading">
        <div className="canvas-editor-loading__spinner" />
        <p className="canvas-editor-loading__text">Loading canvas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="canvas-editor-error">
        <h2 className="canvas-editor-error__title">😕 {error}</h2>
        <button 
          onClick={() => navigate('/')} 
          className="canvas-editor-error__back-button"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="canvas-editor">
      <header className="canvas-editor__header">
        <button 
          onClick={handleBack} 
          className="canvas-editor__back-button"
        >
          ← Back
        </button>
        <h1 className="canvas-editor__title">
          {canvasData?.name || 'Untitled'}
        </h1>
        <div className="canvas-editor__save-status">
          {saveStatus === 'saving' && (
            <span className="canvas-editor__save-text canvas-editor__save-text--saving">
              💾 Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="canvas-editor__save-text canvas-editor__save-text--saved">
              ✓ Saved
            </span>
          )}
        </div>
      </header>
      <div className="canvas-editor__editor-container">
        <Excalidraw
          initialData={{
            elements: canvasData?.elements || [],
            appState: canvasData?.appState || {},
            files: canvasData?.files || {},
          }}
          onChange={(elements, appState, files) => {
            saveCanvas(elements, appState, files)
          }}
        />
      </div>
    </div>
  )
}
