import { useEffect, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import './VersionHistory.css'

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

  // Load versions
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

  if (!isOpen) return null

  return (
    <div className="version-history">
      <div className="version-history__header">
        <h2 className="version-history__title">Version History</h2>
        <button onClick={onClose} className="version-history__close-button">
          ✕
        </button>
      </div>

      <div className="version-history__save-section">
        {showNameInput ? (
          <div className="version-history__name-input-container">
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Version name (optional)"
              className="version-history__name-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveVersion(versionName)
                if (e.key === 'Escape') setShowNameInput(false)
              }}
            />
            <div className="version-history__name-actions">
              <button
                onClick={() => saveVersion(versionName)}
                disabled={saving}
                className="version-history__save-confirm-button"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowNameInput(false)}
                className="version-history__cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="version-history__save-buttons">
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="version-history__save-button"
            >
              💾 Save with Name
            </button>
            <button
              onClick={handleQuickSave}
              disabled={saving}
              className="version-history__quick-save-button"
            >
              ⚡ Quick Save
            </button>
          </div>
        )}
      </div>

      <div className="version-history__list">
        {loading ? (
          <div className="version-history__loading">
            <div className="version-history__spinner" />
          </div>
        ) : versions.length === 0 ? (
          <div className="version-history__empty">
            <p className="version-history__empty-text">No versions saved yet</p>
            <p className="version-history__empty-hint">
              Click "Save Version" to create a checkpoint
            </p>
          </div>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className="version-history__item"
              onClick={() => handleRestore(version)}
            >
              <div className="version-history__item-info">
                <span className="version-history__item-name">
                  {version.name || 'Untitled version'}
                </span>
                <span className="version-history__item-date">
                  {formatDate(version.createdAt)}
                </span>
              </div>
              <span className="version-history__item-action">Restore →</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Floating Save Version Button Component
interface SaveVersionButtonProps {
  onClick: () => void
}

export function SaveVersionButton({ onClick }: SaveVersionButtonProps) {
  return (
    <button onClick={onClick} className="save-version-fab" title="Save Version">
      <span className="save-version-fab__icon">📌</span>
      <span className="save-version-fab__text">Save Version</span>
    </button>
  )
}
