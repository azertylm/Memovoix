import { MemoryEntry } from '../data/memoVoixData';

const DB_NAME = 'AlphabetteMemoVoixDB';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';
const LEGACY_LS_KEY = 'memovoix_memories_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB non supporté'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadMemoriesFromStorage(): Promise<MemoryEntry[]> {
  try {
    const db = await openDB();
    const idbItems = await new Promise<MemoryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as MemoryEntry[]) || []);
      req.onerror = () => reject(req.error);
    });

    if (idbItems.length > 0) {
      return idbItems.sort((a, b) => (b.id > a.id ? 1 : -1));
    }

    // Migration transparente depuis localStorage si existant
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MemoryEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveMemoriesToStorage(parsed);
        return parsed;
      }
    }
    return [];
  } catch {
    try {
      const raw = localStorage.getItem(LEGACY_LS_KEY);
      return raw ? (JSON.parse(raw) as MemoryEntry[]) : [];
    } catch {
      return [];
    }
  }
}

export async function saveMemoriesToStorage(
  memories: MemoryEntry[]
): Promise<void> {
  // Sauvegarde miroir légère dans localStorage (si quota le permet)
  try {
    localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(memories));
  } catch {
    // Quota localStorage dépassé par des photos haute définition : IndexedDB prend le relais
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, 'readwrite');
      const store = tx.objectStore(STORE_MEMORIES);
      store.clear();
      for (const item of memories) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback déjà assuré
  }
}
