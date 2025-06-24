import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

export interface SessionData {
  id?: number;
  sessionId: string;
  status: string;
  operation: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartyConfig {
  id?: number;
  partyId: number;
  webhookUrl: string;
  walletAddress: string;
  initializedAt: Date;
}

export interface PartySessionData {
  id?: number;
  sessionId: string;
  partyId: number;
  status: 'initialized' | 'share_committed' | 'ready' | 'completed' | 'failed';
  operation: string;
  metadata: any;
  threshold: number;
  totalParties: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventData {
  id?: number;
  sessionId: string;
  partyId: number;
  event: string;
  timestamp: string;
  payload: any;
  receivedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'tls-mcp-db';
  private dbVersion = 3; // Increment version for schema changes
  private db: IDBPDatabase | null = null;

  constructor() {}

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  async initDB(): Promise<void> {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`🔄 Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
          
          // Create sessions store (non-sensitive metadata only)
          if (!db.objectStoreNames.contains('sessions')) {
            console.log('📦 Creating sessions object store...');
            const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            sessionsStore.createIndex('sessionId', 'sessionId', { unique: true });
            sessionsStore.createIndex('status', 'status', { unique: false });
          }

          // Create partyConfigs store
          if (!db.objectStoreNames.contains('partyConfigs')) {
            console.log('📦 Creating partyConfigs object store...');
            const store = db.createObjectStore('partyConfigs', { keyPath: 'id', autoIncrement: true });
            store.createIndex('partyId', 'partyId', { unique: true });
          }

          // Create partySessions store (non-sensitive session tracking)
          if (!db.objectStoreNames.contains('partySessions')) {
            console.log('📦 Creating partySessions object store...');
            const store = db.createObjectStore('partySessions', { keyPath: 'id', autoIncrement: true });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('sessionParty', ['sessionId', 'partyId'], { unique: true });
          }

          // Create webhookEvents store (for audit/debugging)
          if (!db.objectStoreNames.contains('webhookEvents')) {
            console.log('📦 Creating webhookEvents object store...');
            const store = db.createObjectStore('webhookEvents', { keyPath: 'id', autoIncrement: true });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('event', 'event', { unique: false });
          }

          // Remove old stores that contained sensitive data
          if (oldVersion < 3) {
            // Remove shares store (contained cryptographic shares)
            if (db.objectStoreNames.contains('shares')) {
              console.log('🗑️ Removing shares object store (security: no cryptographic material storage)');
              db.deleteObjectStore('shares');
            }

            // Remove partyShares store (contained cryptographic shares)
            if (db.objectStoreNames.contains('partyShares')) {
              console.log('🗑️ Removing partyShares object store (security: no cryptographic material storage)');
              db.deleteObjectStore('partyShares');
            }

            // Remove communicationKeys store (contained private keys)
            if (db.objectStoreNames.contains('communicationKeys')) {
              console.log('🗑️ Removing communicationKeys object store (security: no private key storage)');
              db.deleteObjectStore('communicationKeys');
            }
          }
        },
        blocked() {
          console.warn('⚠️ IndexedDB upgrade blocked - another tab may have the database open');
        },
        blocking() {
          console.warn('⚠️ IndexedDB upgrade blocking - this tab is preventing another tab from upgrading');
        }
      });
      
      console.log('✅ IndexedDB initialized successfully (production-ready: no cryptographic material storage)');
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
      const requiredStores = ['sessions', 'partyConfigs', 'partySessions', 'webhookEvents'];
      
      for (const storeName of requiredStores) {
        if (!storeNames.contains(storeName)) {
          console.error(`❌ Missing required object store: ${storeName}`);
          return false;
        }
      }
      
      console.log('✅ Database validation passed');
      return true;
    } catch (error) {
      console.error('❌ Database validation failed:', error);
      return false;
    }
  }

  // ===== SESSION MANAGEMENT (Non-sensitive metadata only) =====

  async storeSession(sessionData: Omit<SessionData, 'id'>): Promise<any> {
    const db = await this.getDb();
    return await db.add('sessions', sessionData);
  }

  async getSession(sessionId: string): Promise<SessionData | undefined> {
    const db = await this.getDb();
    const sessions = await db.getAllFromIndex('sessions', 'sessionId', sessionId);
    return sessions[0];
  }

  async updateSession(sessionData: SessionData): Promise<void> {
    const db = await this.getDb();
    await db.put('sessions', sessionData);
  }

  async getAllSessions(): Promise<SessionData[]> {
    const db = await this.getDb();
    return await db.getAll('sessions');
  }

  async getSessionsByStatus(status: string): Promise<SessionData[]> {
    const db = await this.getDb();
    return await db.getAllFromIndex('sessions', 'status', status);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.getDb();
    const sessions = await db.getAllFromIndex('sessions', 'sessionId', sessionId);
    for (const session of sessions) {
      await db.delete('sessions', session.id);
    }
  }

  // ===== PARTY CONFIGURATION =====

  async storePartyConfig(config: Omit<PartyConfig, 'id'>): Promise<any> {
    const db = await this.getDb();
    return await db.add('partyConfigs', config);
  }

  async getPartyConfig(partyId: number): Promise<PartyConfig | undefined> {
    const db = await this.getDb();
    const configs = await db.getAllFromIndex('partyConfigs', 'partyId', partyId);
    return configs[0];
  }

  // ===== PARTY SESSION TRACKING (Non-sensitive) =====

  async storePartySession(session: Omit<PartySessionData, 'id'>): Promise<any> {
    const db = await this.getDb();
    return await db.add('partySessions', session);
  }

  async getPartySession(sessionId: string, partyId: number): Promise<PartySessionData | undefined> {
    const db = await this.getDb();
    const sessions = await db.getAllFromIndex('partySessions', 'sessionParty', [sessionId, partyId]);
    return sessions[0];
  }

  async updatePartySession(sessionId: string, partyId: number, updates: Partial<PartySessionData>): Promise<void> {
    const db = await this.getDb();
    const session = await this.getPartySession(sessionId, partyId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      await db.put('partySessions', updatedSession);
    }
  }

  async getAllPartySessions(partyId: number): Promise<PartySessionData[]> {
    const db = await this.getDb();
    return await db.getAllFromIndex('partySessions', 'partyId', partyId);
  }

  // ===== WEBHOOK EVENT LOGGING (For audit/debugging) =====

  async storeWebhookEvent(event: Omit<WebhookEventData, 'id' | 'receivedAt'>): Promise<any> {
    const db = await this.getDb();
    const eventWithTimestamp = {
      ...event,
      receivedAt: new Date()
    };
    return await db.add('webhookEvents', eventWithTimestamp);
  }

  async getPartyWebhookEvents(partyId: number): Promise<WebhookEventData[]> {
    const db = await this.getDb();
    return await db.getAllFromIndex('webhookEvents', 'partyId', partyId);
  }

  async getSessionWebhookEvents(sessionId: string): Promise<WebhookEventData[]> {
    const db = await this.getDb();
    return await db.getAllFromIndex('webhookEvents', 'sessionId', sessionId);
  }

  // ===== UTILITY METHODS =====

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(['sessions', 'partyConfigs', 'partySessions', 'webhookEvents'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('sessions').clear(),
      tx.objectStore('partyConfigs').clear(),
      tx.objectStore('partySessions').clear(),
      tx.objectStore('webhookEvents').clear()
    ]);
    
    await tx.done;
    console.log('🗑️ All data cleared from IndexedDB');
  }

  async getDatabaseSize(): Promise<{ sessions: number; partyConfigs: number; partySessions: number; webhookEvents: number }> {
    const db = await this.getDb();
    
    const sessions = await db.count('sessions');
    const partyConfigs = await db.count('partyConfigs');
    const partySessions = await db.count('partySessions');
    const webhookEvents = await db.count('webhookEvents');
    
    return {
      sessions,
      partyConfigs,
      partySessions,
      webhookEvents
    };
  }

  /**
   * Debug method to view all data (for development only)
   */
  async debugViewAllData(): Promise<any> {
    const db = await this.getDb();
    
    const sessions = await db.getAll('sessions');
    const partyConfigs = await db.getAll('partyConfigs');
    const partySessions = await db.getAll('partySessions');
    const webhookEvents = await db.getAll('webhookEvents');
    
    return {
      sessions,
      partyConfigs,
      partySessions,
      webhookEvents,
      summary: {
        sessionsCount: sessions.length,
        partyConfigsCount: partyConfigs.length,
        partySessionsCount: partySessions.length,
        webhookEventsCount: webhookEvents.length
      }
    };
  }

  /**
   * Debug method to clear all data (for development only)
   */
  async debugClearAllData(): Promise<void> {
    console.warn('⚠️ Clearing all data from IndexedDB (debug method)');
    await this.clearAllData();
  }
} 