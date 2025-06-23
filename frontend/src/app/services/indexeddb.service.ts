import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { CryptoService } from './crypto.service';

const toHex = (data: Buffer): string => `0x${data.toString('hex')}`;

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

export interface PartyConfig {
  id?: number;
  partyId: number;
  webhookUrl: string;
  initializedAt: Date;
}

export interface PartySessionData {
  id?: number;
  sessionId: string;
  partyId: number;
  status: 'initialized' | 'share_received' | 'ready' | 'completed' | 'failed';
  operation: string;
  metadata: any;
  threshold: number;
  totalParties: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartyShareData {
  id?: number;
  sessionId: string;
  partyId: number;
  share: string;
  commitment: string;
  nonce: string;
  receivedAt: Date;
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
  private dbVersion = 2;
  private db: IDBPDatabase | null = null;

  constructor(private cryptoService: CryptoService) {}

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
            console.log('📦 Creating sessions object store...');
            const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            sessionsStore.createIndex('sessionId', 'sessionId', { unique: true });
            sessionsStore.createIndex('status', 'status', { unique: false });
          }

          // Create communicationKeys store
          if (!db.objectStoreNames.contains('communicationKeys')) {
            console.log('📦 Creating communicationKeys object store...');
            const store = db.createObjectStore('communicationKeys', { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
          }

          // Create partyConfigs store
          if (!db.objectStoreNames.contains('partyConfigs')) {
            console.log('📦 Creating partyConfigs object store...');
            const store = db.createObjectStore('partyConfigs', { keyPath: 'id', autoIncrement: true });
            store.createIndex('partyId', 'partyId', { unique: true });
          }

          // Create partySessions store
          if (!db.objectStoreNames.contains('partySessions')) {
            console.log('📦 Creating partySessions object store...');
            const store = db.createObjectStore('partySessions', { keyPath: 'id', autoIncrement: true });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('sessionParty', ['sessionId', 'partyId'], { unique: true });
          }

          // Create partyShares store
          if (!db.objectStoreNames.contains('partyShares')) {
            console.log('📦 Creating partyShares object store...');
            const store = db.createObjectStore('partyShares', { keyPath: 'id', autoIncrement: true });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('sessionParty', ['sessionId', 'partyId'], { unique: true });
          }

          // Create webhookEvents store
          if (!db.objectStoreNames.contains('webhookEvents')) {
            console.log('📦 Creating webhookEvents object store...');
            const store = db.createObjectStore('webhookEvents', { keyPath: 'id', autoIncrement: true });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('event', 'event', { unique: false });
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
      const hasCommunicationKeys = storeNames.contains('communicationKeys');
      const hasPartyConfigs = storeNames.contains('partyConfigs');
      const hasPartySessions = storeNames.contains('partySessions');
      const hasPartyShares = storeNames.contains('partyShares');
      const hasWebhookEvents = storeNames.contains('webhookEvents');
      
      console.log('🔍 Database validation:', {
        hasShares,
        hasSessions,
        hasCommunicationKeys,
        hasPartyConfigs,
        hasPartySessions,
        hasPartyShares,
        hasWebhookEvents,
        storeNames: Array.from(storeNames)
      });
      
      return hasShares && hasSessions && hasCommunicationKeys && 
             hasPartyConfigs && hasPartySessions && hasPartyShares && hasWebhookEvents;
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
      const communicationKeys = await this.db!.getAll('communicationKeys');
      const partyConfigs = await this.db!.getAll('partyConfigs');
      const partySessions = await this.db!.getAll('partySessions');
      const partyShares = await this.db!.getAll('partyShares');
      const webhookEvents = await this.db!.getAll('webhookEvents');
      
      const debugData = {
        sessions: { count: sessions.length, data: sessions },
        shares: { count: shares.length, data: shares },
        communicationKeys: { count: communicationKeys.length, data: communicationKeys },
        partyConfigs: { count: partyConfigs.length, data: partyConfigs },
        partySessions: { count: partySessions.length, data: partySessions },
        partyShares: { count: partyShares.length, data: partyShares },
        webhookEvents: { count: webhookEvents.length, data: webhookEvents },
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
      await this.db!.clear('communicationKeys');
      await this.db!.clear('partyConfigs');
      await this.db!.clear('partySessions');
      await this.db!.clear('partyShares');
      await this.db!.clear('webhookEvents');
      
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

  /**
   * Stores an encrypted communication private key for a session party.
   * NOTE: In a production environment, the masterKey would be derived from a user password
   * and would not be stored in IndexedDB. Storing it here is for demonstration purposes only.
   * 
   * @param sessionId The session ID.
   * @param partyId The party ID.
   * @param privateKey The private key to encrypt and store.
   */
  async storeCommunicationKey(sessionId: string, partyId: number, privateKey: string): Promise<void> {
    const db = await this.getDb();
    const id = `${sessionId}-${partyId}`;

    // DEMO ONLY: Generate a random key to encrypt the private key.
    // In production, this should be derived from a user's password.
    const masterKey = toHex(Buffer.from(crypto.getRandomValues(new Uint8Array(32))));

    // Encrypt the private key
    // We need a public key for encryption, so we derive it from the master key
    const masterWallet = this.cryptoService.getWalletFromPrivateKey(masterKey);
    if (!masterWallet) throw new Error('Could not create master wallet for encryption.');
    
    const encryptedPrivateKey = await this.cryptoService.encryptMessage(privateKey, masterWallet.publicKey.substring(4)); // Use uncompressed public key

    await db.put('communicationKeys', {
      id,
      sessionId,
      partyId,
      encryptedPrivateKey,
      masterKey // DEMO ONLY: Do not store this in production.
    });
  }

  /**
   * Retrieves and decrypts a communication private key.
   * @param sessionId The session ID.
   * @param partyId The party ID.
   * @returns The decrypted private key, or null if not found.
   */
  async getCommunicationKey(sessionId: string, partyId: number): Promise<string | null> {
    const db = await this.getDb();
    const id = `${sessionId}-${partyId}`;
    const record = await db.get('communicationKeys', id);

    if (!record || !record.encryptedPrivateKey || !record.masterKey) {
      return null;
    }

    // Decrypt the private key using the stored master key.
    // In production, the master key would come from a user password prompt.
    return this.cryptoService.decryptMessage(record.encryptedPrivateKey, record.masterKey);
  }

  // Party-related methods
  async storePartyConfig(config: Omit<PartyConfig, 'id'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('partyConfigs', config);
  }

  async getPartyConfig(partyId: number): Promise<PartyConfig | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.getFromIndex('partyConfigs', 'partyId', partyId);
  }

  async storePartySession(session: Omit<PartySessionData, 'id'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('partySessions', session);
  }

  async getPartySession(sessionId: string, partyId: number): Promise<PartySessionData | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.getFromIndex('partySessions', 'sessionParty', [sessionId, partyId]);
  }

  async updatePartySession(sessionId: string, partyId: number, updates: Partial<PartySessionData>): Promise<void> {
    if (!this.db) await this.initDB();
    const session = await this.getPartySession(sessionId, partyId);
    if (session) {
      await this.db!.put('partySessions', { ...session, ...updates });
    }
  }

  async getAllPartySessions(partyId: number): Promise<PartySessionData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAllFromIndex('partySessions', 'partyId', partyId);
  }

  async storePartyShare(share: Omit<PartyShareData, 'id'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('partyShares', share);
  }

  async getPartyShare(sessionId: string, partyId: number): Promise<PartyShareData | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.getFromIndex('partyShares', 'sessionParty', [sessionId, partyId]);
  }

  async getAllPartyShares(partyId: number): Promise<PartyShareData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAllFromIndex('partyShares', 'partyId', partyId);
  }

  async storeWebhookEvent(event: Omit<WebhookEventData, 'id' | 'receivedAt'>): Promise<any> {
    if (!this.db) await this.initDB();
    return await this.db!.add('webhookEvents', {
      ...event,
      receivedAt: new Date()
    });
  }

  async getPartyWebhookEvents(partyId: number): Promise<WebhookEventData[]> {
    if (!this.db) await this.initDB();
    return await this.db!.getAllFromIndex('webhookEvents', 'partyId', partyId);
  }
} 