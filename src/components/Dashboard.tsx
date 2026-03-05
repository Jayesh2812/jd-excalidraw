import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import './Dashboard.css'

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
    }
    setIsCreating(false)
  }

  const deleteCanvas = async (canvasId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    if (!confirm('Are you sure you want to delete this canvas?')) return

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'canvases', canvasId))
    } catch (error) {
      console.error('Error deleting canvas:', error)
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

  const isButtonDisabled = isCreating || !newCanvasName.trim()

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__logo">Excalidraw</h1>
        <div className="dashboard__user-section">
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt="" 
              className="dashboard__avatar" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="dashboard__avatar-fallback">
              {(user?.displayName || user?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <span className="dashboard__user-name">
            {user?.displayName || user?.email}
          </span>
          <button onClick={logout} className="dashboard__logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard__main">
        <div className="dashboard__create-section">
          <input
            type="text"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            placeholder="Enter canvas name..."
            className="dashboard__input"
            onKeyDown={(e) => e.key === 'Enter' && createCanvas()}
          />
          <button
            onClick={createCanvas}
            disabled={isButtonDisabled}
            className={`dashboard__create-button ${isButtonDisabled ? 'dashboard__create-button--disabled' : ''}`}
          >
            {isCreating ? 'Creating...' : '+ New Canvas'}
          </button>
        </div>

        {loading ? (
          <div className="dashboard__loading">
            <div className="dashboard__spinner" />
          </div>
        ) : canvases.length === 0 ? (
          <div className="dashboard__empty-state">
            <div className="dashboard__empty-icon">🎨</div>
            <h2 className="dashboard__empty-title">No canvases yet</h2>
            <p className="dashboard__empty-text">
              Create your first canvas to start drawing!
            </p>
          </div>
        ) : (
          <div className="dashboard__grid">
            {canvases.map((canvas) => (
              <div
                key={canvas.id}
                className="canvas-card"
                onClick={() => navigate(`/canvas/${canvas.id}`)}
              >
                <div className="canvas-card__preview">
                  <span className="canvas-card__preview-icon">✏️</span>
                </div>
                <div className="canvas-card__content">
                  <h3 className="canvas-card__title">{canvas.name}</h3>
                  <p className="canvas-card__date">
                    Updated: {formatDate(canvas.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteCanvas(canvas.id, e)}
                  className="canvas-card__delete-button"
                  title="Delete canvas"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
