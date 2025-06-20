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
    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Create shares store
        if (!db.objectStoreNames.contains('shares')) {
          const sharesStore = db.createObjectStore('shares', { keyPath: 'id', autoIncrement: true });
          sharesStore.createIndex('sessionId', 'sessionId', { unique: false });
          sharesStore.createIndex('partyId', 'partyId', { unique: false });
          sharesStore.createIndex('sessionParty', ['sessionId', 'partyId'], { unique: true });
        }

        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          sessionsStore.createIndex('sessionId', 'sessionId', { unique: true });
          sessionsStore.createIndex('status', 'status', { unique: false });
        }
      }
    });
  }

  async storeShare(shareData: Omit<ShareData, 'id'>): Promise<number> {
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

  async storeSession(sessionData: Omit<SessionData, 'id'>): Promise<number> {
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
} 