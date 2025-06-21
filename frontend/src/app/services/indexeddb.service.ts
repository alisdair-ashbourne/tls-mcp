import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

export interface ShareData {
  id?: number;
  sessionId: string;
  partyId: number;
  share: string;
  commitment: string;
  nonce: string;
  createdAt: Date;
}

export interface SessionData {
  id?: number;
  sessionId: string;
  status: string;
  operation: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'tls-mcp-db';
  private dbVersion = 1;
  private db: IDBPDatabase | null = null;

  async initDB(): Promise<void> {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`🔄 Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
          
          // Create shares store
          if (!db.objectStoreNames.contains('shares')) {
            console.log('📦 Creating shares object store...');
            const sharesStore = db.createObjectStore('shares', { keyPath: 'id', autoIncrement: true });
            sharesStore.createIndex('sessionId', 'sessionId', { unique: false });
            sharesStore.createIndex('partyId', 'partyId', { unique: false });
            sharesStore.createIndex('sessionParty', ['sessionId', 'partyId'], { unique: true });
          }

          // Create sessions store
          if (!db.objectStoreNames.contains('sessions')) {
            console.log('📋 Creating sessions object store...');
            const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            sessionsStore.createIndex('sessionId', 'sessionId', { unique: true });
            sessionsStore.createIndex('status', 'status', { unique: false });
          }
        },
        blocked() {
          console.warn('⚠️ IndexedDB upgrade blocked - another tab may have the database open');
        },
        blocking() {
          console.warn('⚠️ IndexedDB upgrade blocking - this tab is preventing another tab from upgrading');
        }
      });
      
      console.log('✅ IndexedDB initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Reset the database by deleting it and recreating it
   * This is useful when the database is in an inconsistent state
   */
  async resetDatabase(): Promise<void> {
    try {
      console.log('🔄 Resetting IndexedDB...');
      
      // Close existing connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      // Delete the database
      await indexedDB.deleteDatabase(this.dbName);
      console.log('🗑️ Database deleted');
      
      // Wait a moment for the deletion to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reinitialize the database
      await this.initDB();
      console.log('✅ Database reset completed');
    } catch (error) {
      console.error('❌ Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * Check if the database has the required object stores
   */
  async validateDatabase(): Promise<boolean> {
    try {
      if (!this.db) await this.initDB();
      
      const storeNames = this.db!.objectStoreNames;
      const hasShares = storeNames.contains('shares');
      const hasSessions = storeNames.contains('sessions');
      
      console.log('🔍 Database validation:', {
        hasShares,
        hasSessions,
        storeNames: Array.from(storeNames)
      });
      
      return hasShares && hasSessions;
    } catch (error) {
      console.error('❌ Database validation failed:', error);
      return false;
    }
  }

  async storeShare(shareData: Omit<ShareData, 'id'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('shares', shareData);
  }

  async getSharesBySession(sessionId: string): Promise<ShareData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAllFromIndex('shares', 'sessionId', sessionId);
  }

  async getShareBySessionAndParty(sessionId: string, partyId: number): Promise<ShareData | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.getFromIndex('shares', 'sessionParty', [sessionId, partyId]);
  }

  async updateShare(shareData: ShareData): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.put('shares', shareData);
  }

  async deleteSharesBySession(sessionId: string): Promise<void> {
    if (!this.db) await this.initDB();
    const shares = await this.getSharesBySession(sessionId);
    for (const share of shares) {
      await this.db!.delete('shares', share.id!);
    }
  }

  async storeSession(sessionData: Omit<SessionData, 'id'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('sessions', sessionData);
  }

  async getSession(sessionId: string): Promise<SessionData | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.getFromIndex('sessions', 'sessionId', sessionId);
  }

  async updateSession(sessionData: SessionData): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.put('sessions', sessionData);
  }

  async getAllSessions(): Promise<SessionData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAll('sessions');
  }

  async getSessionsByStatus(status: string): Promise<SessionData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAllFromIndex('sessions', 'status', status);
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) await this.initDB();
    const session = await this.getSession(sessionId);
    if (session) {
      await this.db!.delete('sessions', session.id!);
      await this.deleteSharesBySession(sessionId);
    }
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.clear('shares');
    await this.db!.clear('sessions');
  }

  async getDatabaseSize(): Promise<{ shares: number; sessions: number }> {
    if (!this.db) await this.initDB();
    const shares = await this.db!.count('shares');
    const sessions = await this.db!.count('sessions');
    return { shares, sessions };
  }

  /**
   * Debug method to view all data in IndexedDB
   * This can be called from browser console: indexedDBService.debugViewAllData()
   */
  async debugViewAllData(): Promise<any> {
    try {
      if (!this.db) await this.initDB();
      
      const sessions = await this.db!.getAll('sessions');
      const shares = await this.db!.getAll('shares');
      
      const debugData = {
        sessions: { count: sessions.length, data: sessions },
        shares: { count: shares.length, data: shares },
        timestamp: new Date().toISOString()
      };
      
      console.log('🔍 IndexedDB Debug Data:', debugData);
      return debugData;
    } catch (error) {
      console.error('❌ Error accessing IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Debug method to clear all data in IndexedDB
   * This can be called from browser console: indexedDBService.debugClearAllData()
   */
  async debugClearAllData(): Promise<void> {
    try {
      if (!this.db) await this.initDB();
      
      await this.db!.clear('sessions');
      await this.db!.clear('shares');
      
      console.log('🗑️ IndexedDB data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing IndexedDB:', error);
      throw error;
    }
  }

  private async getAllFromStore(transaction: IDBTransaction, storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearStore(transaction: IDBTransaction, storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
} 