type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
};

const DB_NAME = 'bu-scheduler-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let openPromise: Promise<IDBDatabase> | null = null;

function isBrowserStorageAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openDatabase() {
  if (!isBrowserStorageAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }

  if (openPromise) {
    return openPromise;
  }

  openPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline cache.'));
  });

  return openPromise;
}

async function readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const db = await openDatabase();
    return await new Promise<CacheEnvelope<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve((request.result as CacheEnvelope<T> | undefined) ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read offline cache.'));
    });
  } catch {
    return null;
  }
}

async function writeEnvelope<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ value, updatedAt: Date.now() } satisfies CacheEnvelope<T>, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to write offline cache.'));
    });
  } catch {
    // Ignore cache write failures; the live fetch still succeeded.
  }
}

export async function readCachedValue<T>(key: string): Promise<T | null> {
  const envelope = await readEnvelope<T>(key);
  return envelope?.value ?? null;
}

export async function writeCachedValue<T>(key: string, value: T): Promise<void> {
  await writeEnvelope(key, value);
}

export async function clearCachedValue(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to clear offline cache.'));
    });
  } catch {
    // Ignore clear failures as this is only a best-effort cache.
  }
}

export async function clearCachedValuesByPrefix(prefix: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const key = String(cursor.key);
        if (key.startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };

      request.onerror = () => reject(request.error ?? new Error('Failed to clear offline cache.'));
    });
  } catch {
    // Ignore prefix clear failures as this is only a best-effort cache.
  }
}

export async function withCachedValue<T>(params: {
  key: string;
  loader: () => Promise<T>;
  fallback: T;
}): Promise<T> {
  const { key, loader, fallback } = params;

  try {
    const value = await loader();
    await writeCachedValue(key, value);
    return value;
  } catch {
    const cached = await readCachedValue<T>(key);
    return cached ?? fallback;
  }
}
