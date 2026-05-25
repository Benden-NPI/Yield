// IndexedDB helpers for persisting the Excel file handle across sessions.
// Uses a dedicated DB so it doesn't conflict with the main app's storage.

const DB_NAME = 'yield-tool-gantt';
const STORE   = 'h';
const KEY     = 'tool-excel';

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = (e) => (e.target as IDBOpenDBRequest).result.createObjectStore(STORE);
    r.onsuccess = (e) => res((e.target as IDBOpenDBRequest).result);
    r.onerror   = () => rej(r.error);
  });
}

export async function idbSaveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

export async function idbLoadHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => res((req.result as FileSystemFileHandle) ?? null);
    req.onerror   = () => rej(req.error);
  });
}

export async function idbClearHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
