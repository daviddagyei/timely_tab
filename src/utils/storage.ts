import { StorageData } from '../types';

/**
 * Storage helper class for Chrome extension storage
 */
export class StorageHelper {
  /**
   * Gets data from Chrome local storage
   */
  static async getLocal<K extends keyof StorageData>(
    keys: K | K[]
  ): Promise<Pick<StorageData, K>> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error reading from local storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully read from local storage:', result);
          resolve(result as Pick<StorageData, K>);
        }
      });
    });
  }

  /**
   * Sets data in Chrome local storage
   */
  static async setLocal(data: Partial<StorageData>): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error saving to local storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully saved to local storage:', Object.keys(data));
          resolve();
        }
      });
    });
  }

  /**
   * Gets data from Chrome sync storage
   */
  static async getSync<K extends keyof StorageData>(
    keys: K | K[]
  ): Promise<Pick<StorageData, K>> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error reading from sync storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully read from sync storage:', result);
          resolve(result as Pick<StorageData, K>);
        }
      });
    });
  }

  /**
   * Sets data in Chrome sync storage
   */
  static async setSync(data: Partial<StorageData>): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error saving to sync storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully saved to sync storage:', Object.keys(data));
          resolve();
        }
      });
    });
  }

  /**
   * Removes keys from Chrome local storage
   */
  static async removeLocal(keys: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error removing from local storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully removed from local storage:', keys);
          resolve();
        }
      });
    });
  }

  /**
   * Removes keys from Chrome sync storage
   */
  static async removeSync(keys: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          console.error('[Storage] Error removing from sync storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Storage] Successfully removed from sync storage:', keys);
          resolve();
        }
      });
    });
  }
}
