// Browser-based IndexedDB cache for very large base64 files
// Prevents Firestore 1MB document limit errors by storing heavy base64 strings locally in the browser,
// while saving a lightweight metadata token in Firestore.

import { ExamBankItem, ExamBankFile } from '../types';
import { db } from '../data/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

class LocalFileCache {
  private dbName = 'ielts_file_cache_db';
  private storeName = 'files';
  private db: IDBDatabase | null = null;
  private useFallback = false;
  private fallbackMemoryCache = new Map<string, string>();
  private initPromise: Promise<IDBDatabase | null> | null = null;

  private async init(): Promise<IDBDatabase | null> {
    if (this.useFallback) return null;
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase | null>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('IndexedDB initialization timed out. Falling back to in-memory cache.');
        this.useFallback = true;
        resolve(null);
      }, 300);

      try {
        if (typeof indexedDB === 'undefined') {
          clearTimeout(timeout);
          this.useFallback = true;
          return resolve(null);
        }

        const request = indexedDB.open(this.dbName, 1);
        
        request.onupgradeneeded = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          } catch (err) {
            // upgradeneeded can fail under restrictive policies
          }
        };

        request.onsuccess = () => {
          clearTimeout(timeout);
          this.db = request.result;
          resolve(this.db);
        };

        request.onerror = (err) => {
          clearTimeout(timeout);
          console.warn('IndexedDB open error, using in-memory fallback:', err);
          this.useFallback = true;
          resolve(null);
        };
      } catch (err) {
        clearTimeout(timeout);
        console.warn('IndexedDB direct catch error, using in-memory fallback:', err);
        this.useFallback = true;
        resolve(null);
      }
    });

    return this.initPromise;
  }

  async get(key: string): Promise<string | null> {
    // 1. Try local memory cache first
    const memoryVal = this.fallbackMemoryCache.get(key);
    if (memoryVal) return memoryVal;

    let localVal: string | null = null;
    if (!this.useFallback) {
      try {
        const db = await this.init();
        if (db) {
          localVal = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('IndexedDB get timed out for key:', key);
              resolve(null);
            }, 200);

            try {
              const transaction = db.transaction(this.storeName, 'readonly');
              const store = transaction.objectStore(this.storeName);
              const request = store.get(key);
              request.onsuccess = () => {
                clearTimeout(timeout);
                resolve(request.result || null);
              };
              request.onerror = () => {
                clearTimeout(timeout);
                resolve(null);
              };
            } catch (e) {
              clearTimeout(timeout);
              resolve(null);
            }
          });
        }
      } catch (e) {
        console.warn('IndexedDB get error, trying fallback:', e);
      }
    }

    if (localVal) {
      this.fallbackMemoryCache.set(key, localVal);
      return localVal;
    }

    // 2. Fallback to Firestore since it's not found in local browser's IndexedDB
    try {
      const docRef = doc(db, 'cached_files', key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const content = docSnap.data()?.content;
        if (content) {
          this.fallbackMemoryCache.set(key, content);
          
          // Silently cache in local IndexedDB for future instant loads
          if (!this.useFallback) {
            try {
              const dbInstance = await this.init();
              if (dbInstance) {
                const transaction = dbInstance.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                store.put(content, key);
              }
            } catch (err) {
              // ignore
            }
          }
          return content;
        }
      }
    } catch (e) {
      console.warn('Firestore get cached file error:', e);
    }

    return null;
  }

  async set(key: string, value: string): Promise<void> {
    // 1. Keep in local memory cache
    this.fallbackMemoryCache.set(key, value);

    // 2. Try to store in IndexedDB
    if (!this.useFallback) {
      try {
        const db = await this.init();
        if (db) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('IndexedDB set timed out');
              resolve();
            }, 300);

            try {
              const transaction = db.transaction(this.storeName, 'readwrite');
              const store = transaction.objectStore(this.storeName);
              const request = store.put(value, key);
              request.onsuccess = () => {
                clearTimeout(timeout);
                resolve();
              };
              request.onerror = () => {
                clearTimeout(timeout);
                resolve();
              };
            } catch (e) {
              clearTimeout(timeout);
              resolve();
            }
          });
        }
      } catch (e) {
        console.warn('IndexedDB set error:', e);
      }
    }

    // 3. Store in Firestore so other browsers/devices can retrieve it!
    try {
      const docRef = doc(db, 'cached_files', key);
      await setDoc(docRef, { content: value });
    } catch (e) {
      console.warn('Firestore set cached file error:', e);
    }
  }

  async delete(key: string): Promise<void> {
    this.fallbackMemoryCache.delete(key);
    if (this.useFallback) return;

    try {
      const db = await this.init();
      if (!db || this.useFallback) return;

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 200);

        try {
          const transaction = db.transaction(this.storeName, 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.delete(key);
          request.onsuccess = () => {
            clearTimeout(timeout);
            resolve();
          };
          request.onerror = () => {
            clearTimeout(timeout);
            resolve();
          };
        } catch (e) {
          clearTimeout(timeout);
          resolve();
        }
      });
    } catch (e) {
      console.warn('IndexedDB delete error:', e);
    }
  }
}

export const localFileCache = new LocalFileCache();

// Helper to determine if a string is a base64 Data URL and is too large
export const isLargeBase64 = (str: string | undefined | null, limit = 100000): boolean => {
  if (!str) return false;
  return str.startsWith('data:') && str.length > limit;
};

// Generates a local cache token
export const createCacheToken = (cacheKey: string, fileName: string, fileSize: number, fileType: string): string => {
  // Replace colons in filename with underscores to avoid breaking the split format
  const safeName = fileName.replace(/:/g, '_');
  return `localcache:${cacheKey}:${safeName}:${fileSize}:${fileType}`;
};

// Parses a local cache token back to metadata
export interface CacheTokenMetadata {
  cacheKey: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export const parseCacheToken = (token: string): CacheTokenMetadata | null => {
  if (!token || !token.startsWith('localcache:')) return null;
  const parts = token.split(':');
  if (parts.length < 5) return null;
  return {
    cacheKey: parts[1],
    fileName: parts[2],
    fileSize: parseInt(parts[3]) || 0,
    fileType: parts[4]
  };
};

export const resolveFileUrl = async (url: string | undefined): Promise<string> => {
  if (!url) return '';
  const meta = parseCacheToken(url);
  if (meta) {
    const cached = await localFileCache.get(meta.cacheKey);
    if (cached) return cached;
  }
  return url;
};

export const resolveFileList = async (files: ExamBankFile[] | undefined): Promise<ExamBankFile[]> => {
  if (!files || !Array.isArray(files)) return [];
  const resolved: ExamBankFile[] = [];
  for (const f of files) {
    resolved.push({
      ...f,
      url: await resolveFileUrl(f.url)
    });
  }
  return resolved;
};

export const resolveExamBankItem = async (item: ExamBankItem): Promise<ExamBankItem> => {
  const resolvedWord = await resolveFileUrl(item.wordFileUrl);
  const resolvedPdf = await resolveFileUrl(item.pdfFileUrl);
  const resolvedAudios = await resolveFileList(item.audioFiles);
  const resolvedImages = await resolveFileList(item.imageFiles);

  const storage = item.storageFiles;
  let resolvedStorage = null;
  if (storage) {
    let resolvedListening = null;
    if (storage.listening) {
      resolvedListening = {
        wordFileUrl: await resolveFileUrl(storage.listening.wordFileUrl),
        audioFiles: await resolveFileList(storage.listening.audioFiles),
        imageFiles: await resolveFileList(storage.listening.imageFiles),
      };
    }
    let resolvedReading = null;
    if (storage.reading) {
      resolvedReading = {
        wordFileUrl: await resolveFileUrl(storage.reading.wordFileUrl),
        imageFiles: await resolveFileList(storage.reading.imageFiles),
      };
    }
    let resolvedWriting = null;
    if (storage.writing) {
      resolvedWriting = {
        wordFileUrl: await resolveFileUrl(storage.writing.wordFileUrl),
        imageFiles: await resolveFileList(storage.writing.imageFiles),
      };
    }
    let resolvedSpeaking = null;
    if (storage.speaking) {
      resolvedSpeaking = {
        wordFileUrl: await resolveFileUrl(storage.speaking.wordFileUrl),
      };
    }

    resolvedStorage = {
      wordFileUrl: await resolveFileUrl(storage.wordFileUrl),
      pdfFileUrl: await resolveFileUrl(storage.pdfFileUrl),
      audioFiles: await resolveFileList(storage.audioFiles),
      imageFiles: await resolveFileList(storage.imageFiles),
      listening: resolvedListening,
      reading: resolvedReading,
      writing: resolvedWriting,
      speaking: resolvedSpeaking,
    };
  }

  return {
    ...item,
    wordFileUrl: resolvedWord,
    pdfFileUrl: resolvedPdf,
    audioFiles: resolvedAudios,
    imageFiles: resolvedImages,
    storageFiles: resolvedStorage as any
  };
};

