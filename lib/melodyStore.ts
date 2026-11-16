const DB_NAME = "timers-db";
const DB_VERSION = 1;
const STORE = "melody";
const KEY = "custom";

export interface MelodyRecord {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB недоступен"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB заблокирован"));
  });
}

export async function saveMelody(file: File): Promise<MelodyRecord> {
  const db = await openDb();
  try {
    const record: MelodyRecord = {
      id: KEY,
      name: file.name,
      type: file.type || "audio/mpeg",
      blob: file,
      savedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Не удалось сохранить мелодию"));
      tx.onabort = () => reject(tx.error ?? new Error("Сохранение отменено"));
    });

    return record;
  } finally {
    db.close();
  }
}

export async function readMelody(): Promise<MelodyRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<MelodyRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as MelodyRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Не удалось прочитать мелодию"));
    });
  } finally {
    db.close();
  }
}

export async function clearMelody(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Не удалось удалить мелодию"));
    });
  } finally {
    db.close();
  }
}
