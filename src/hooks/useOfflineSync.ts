/**
 * Hook for managing offline sync state and operations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  isOnline,
  onOnlineStatusChange,
  getPendingOperations,
  clearPendingOperation,
  getPendingSyncCanvases,
  markCanvasSynced,
} from '../utils/offlineStorage'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingChanges: number
}

export function useOfflineSync(userId: string | undefined) {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: isOnline(),
    isSyncing: false,
    pendingChanges: 0,
  })
  const syncInProgressRef = useRef(false)

  // Check pending changes count
  const checkPendingChanges = useCallback(async () => {
    if (!userId) return
    
    try {
      const pendingOps = await getPendingOperations()
      const pendingCanvases = await getPendingSyncCanvases(userId)
      setSyncState(prev => ({
        ...prev,
        pendingChanges: pendingOps.length + pendingCanvases.length,
      }))
    } catch (err) {
      console.error('Error checking pending changes:', err)
    }
  }, [userId])

  // Sync pending operations to Firestore
  const syncToFirestore = useCallback(async () => {
    if (!userId || syncInProgressRef.current || !isOnline()) return

    syncInProgressRef.current = true
    setSyncState(prev => ({ ...prev, isSyncing: true }))

    try {
      // Sync pending operations
      const pendingOps = await getPendingOperations()
      
      for (const op of pendingOps) {
        try {
          const docRef = doc(db, 'users', op.userId, op.collection, op.docId)
          
          switch (op.type) {
            case 'create':
              await setDoc(docRef, {
                ...op.data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
              break
            case 'update':
              await updateDoc(docRef, {
                ...op.data,
                updatedAt: serverTimestamp(),
              })
              break
            case 'delete':
              await deleteDoc(docRef)
              break
          }
          
          if (op.id) {
            await clearPendingOperation(op.id)
          }
        } catch (err) {
          console.error('Error syncing operation:', op, err)
        }
      }

      // Sync pending canvas content
      const pendingCanvases = await getPendingSyncCanvases(userId)
      
      for (const canvas of pendingCanvases) {
        try {
          const docRef = doc(db, 'users', userId, 'canvases', canvas.id)
          await updateDoc(docRef, {
            content: canvas.data.content,
            preview: canvas.data.preview,
            updatedAt: serverTimestamp(),
          })
          await markCanvasSynced(canvas.id)
        } catch (err) {
          console.error('Error syncing canvas:', canvas.id, err)
        }
      }

      await checkPendingChanges()
    } catch (err) {
      console.error('Error during sync:', err)
    } finally {
      syncInProgressRef.current = false
      setSyncState(prev => ({ ...prev, isSyncing: false }))
    }
  }, [userId, checkPendingChanges])

  // Listen for online/offline status changes
  useEffect(() => {
    const cleanup = onOnlineStatusChange((online) => {
      setSyncState(prev => ({ ...prev, isOnline: online }))
      
      // Auto-sync when coming back online
      if (online) {
        syncToFirestore()
      }
    })

    return cleanup
  }, [syncToFirestore])

  // Initial pending changes check
  useEffect(() => {
    checkPendingChanges()
  }, [checkPendingChanges])

  // Auto-sync on mount if online
  useEffect(() => {
    if (isOnline() && userId) {
      syncToFirestore()
    }
  }, [userId, syncToFirestore])

  return {
    ...syncState,
    syncToFirestore,
    checkPendingChanges,
  }
}
