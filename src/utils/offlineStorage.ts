/**
 * Offline storage utility using IndexedDB
 * Provides local caching for canvases and folders with sync support
 */

const DB_NAME = 'monobook-offline'
const DB_VERSION = 1

interface OfflineCanvas {
  id: string
  data: any
  lastModified: number
  pendingSync: boolean
  userId: string
}

interface OfflineFolder {
  id: string
  data: any
  userId: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Canvases store
      if (!db.objectStoreNames.contains('canvases')) {
        const canvasStore = db.createObjectStore('canvases', { keyPath: 'id' })
        canvasStore.createIndex('userId', 'userId', { unique: false })
        canvasStore.createIndex('pendingSync', 'pendingSync', { unique: false })
      }

      // Folders store
      if (!db.objectStoreNames.contains('folders')) {
        const folderStore = db.createObjectStore('folders', { keyPath: 'id' })
        folderStore.createIndex('userId', 'userId', { unique: false })
      }

      // Pending operations queue for offline changes
      if (!db.objectStoreNames.contains('pendingOps')) {
        const opsStore = db.createObjectStore('pendingOps', { keyPath: 'id', autoIncrement: true })
        opsStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })

  return dbPromise
}

// Canvas operations
export async function saveCanvasOffline(userId: string, canvasId: string, data: any, pendingSync = false): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('canvases', 'readwrite')
    const store = tx.objectStore('canvases')
    
    const canvas: OfflineCanvas = {
      id: canvasId,
      data,
      lastModified: Date.now(),
      pendingSync,
      userId,
    }
    
    const request = store.put(canvas)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getCanvasOffline(canvasId: string): Promise<OfflineCanvas | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('canvases', 'readonly')
    const store = tx.objectStore('canvases')
    const request = store.get(canvasId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function getAllCanvasesOffline(userId: string): Promise<OfflineCanvas[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('canvases', 'readonly')
    const store = tx.objectStore('canvases')
    const index = store.index('userId')
    const request = index.getAll(userId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteCanvasOffline(canvasId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('canvases', 'readwrite')
    const store = tx.objectStore('canvases')
    const request = store.delete(canvasId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getPendingSyncCanvases(userId: string): Promise<OfflineCanvas[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('canvases', 'readonly')
    const store = tx.objectStore('canvases')
    const results: OfflineCanvas[] = []
    
    const request = store.openCursor()
    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        const canvas = cursor.value as OfflineCanvas
        if (canvas.userId === userId && canvas.pendingSync) {
          results.push(canvas)
        }
        cursor.continue()
      } else {
        resolve(results)
      }
    }
  })
}

export async function markCanvasSynced(canvasId: string): Promise<void> {
  const canvas = await getCanvasOffline(canvasId)
  if (canvas) {
    canvas.pendingSync = false
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('canvases', 'readwrite')
      const store = tx.objectStore('canvases')
      const request = store.put(canvas)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// Folder operations
export async function saveFolderOffline(userId: string, folderId: string, data: any): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite')
    const store = tx.objectStore('folders')
    
    const folder: OfflineFolder = {
      id: folderId,
      data,
      userId,
    }
    
    const request = store.put(folder)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getAllFoldersOffline(userId: string): Promise<OfflineFolder[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readonly')
    const store = tx.objectStore('folders')
    const index = store.index('userId')
    const request = index.getAll(userId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteFolderOffline(folderId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite')
    const store = tx.objectStore('folders')
    const request = store.delete(folderId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Pending operations for offline changes
interface PendingOperation {
  id?: number
  type: 'create' | 'update' | 'delete'
  collection: 'canvases' | 'folders'
  docId: string
  data?: any
  timestamp: number
  userId: string
}

export async function addPendingOperation(op: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOps', 'readwrite')
    const store = tx.objectStore('pendingOps')
    
    const operation: PendingOperation = {
      ...op,
      timestamp: Date.now(),
    }
    
    const request = store.add(operation)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOps', 'readonly')
    const store = tx.objectStore('pendingOps')
    const index = store.index('timestamp')
    const request = index.getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function clearPendingOperation(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOps', 'readwrite')
    const store = tx.objectStore('pendingOps')
    const request = store.delete(id)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function clearAllPendingOperations(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOps', 'readwrite')
    const store = tx.objectStore('pendingOps')
    const request = store.clear()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Online/Offline status
export function isOnline(): boolean {
  return navigator.onLine
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
