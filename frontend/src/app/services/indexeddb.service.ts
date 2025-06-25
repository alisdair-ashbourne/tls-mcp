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
  walletAddress?: string; // Store reconstructed wallet address
  threshold?: number;
  totalParties?: number;
  participatingParties?: number[];
}

export interface PartyConfig {
  id?: number;
  partyId: number;
  webhookUrl: string;
  walletAddress: string;
  initializedAt: Date;
  sessionId?: string; // Link to specific session
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
  shareCommitment?: string; // Store commitment (not the actual share)
  walletAddress?: string; // Store reconstructed wallet address
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

export interface WalletReconstructionData {
  id?: number;
  sessionId: string;
  walletAddress: string;
  publicKey: string;
  reconstructionTimestamp: Date;
  participatingParties: number[];
  threshold: number;
  verified: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {
  private dbName = 'tls-mcp-db';
  private dbVersion = 4; // Increment version for schema changes
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.db) {
      if (!this.initPromise) {
        this.initPromise = this.initDB();
      }
      await this.initPromise;
    }
    return this.db!;
  }

  async initDB(): Promise<void> {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion, newVersion) {
          console.log(
            `🔄 Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`
          );

          // Create sessions store (non-sensitive metadata only)
          if (!db.objectStoreNames.contains('sessions')) {
            console.log('📦 Creating sessions object store...');
            const sessionsStore = db.createObjectStore('sessions', {
              keyPath: 'id',
              autoIncrement: true,
            });
            sessionsStore.createIndex('sessionId', 'sessionId', {
              unique: true,
            });
            sessionsStore.createIndex('status', 'status', { unique: false });
            sessionsStore.createIndex('operation', 'operation', {
              unique: false,
            });
            sessionsStore.createIndex('createdAt', 'createdAt', {
              unique: false,
            });
          }

          // Create partyConfigs store
          if (!db.objectStoreNames.contains('partyConfigs')) {
            console.log('📦 Creating partyConfigs object store...');
            const store = db.createObjectStore('partyConfigs', {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partySessionId', ['partyId', 'sessionId'], {
              unique: true,
            });
          }

          // Create partySessions store (non-sensitive session tracking)
          if (!db.objectStoreNames.contains('partySessions')) {
            console.log('📦 Creating partySessions object store...');
            const store = db.createObjectStore('partySessions', {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('sessionParty', ['sessionId', 'partyId'], {
              unique: true,
            });
            store.createIndex('status', 'status', { unique: false });
          }

          // Create webhookEvents store (for audit/debugging)
          if (!db.objectStoreNames.contains('webhookEvents')) {
            console.log('📦 Creating webhookEvents object store...');
            const store = db.createObjectStore('webhookEvents', {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('partyId', 'partyId', { unique: false });
            store.createIndex('event', 'event', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // Create walletReconstructions store (for wallet restoration tracking)
          if (!db.objectStoreNames.contains('walletReconstructions')) {
            console.log('📦 Creating walletReconstructions object store...');
            const store = db.createObjectStore('walletReconstructions', {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('sessionId', 'sessionId', { unique: true });
            store.createIndex('walletAddress', 'walletAddress', {
              unique: false,
            });
            store.createIndex(
              'reconstructionTimestamp',
              'reconstructionTimestamp',
              { unique: false }
            );
          }

          // Update existing stores with new fields (version 4+)
          if (oldVersion < 4) {
            console.log('🔄 Updating object stores for version 4...');

            // Note: New indexes are already created above when object stores are created
            // For existing sessions store, we would need to recreate it to add indexes
            // This is handled by the store creation logic above
          }

          // Remove old stores that contained sensitive data
          if (oldVersion < 3) {
            // Remove shares store (contained cryptographic shares)
            if (db.objectStoreNames.contains('shares')) {
              console.log(
                '🗑️ Removing shares object store (security: no cryptographic material storage)'
              );
              db.deleteObjectStore('shares');
            }

            // Remove partyShares store (contained cryptographic shares)
            if (db.objectStoreNames.contains('partyShares')) {
              console.log(
                '🗑️ Removing partyShares object store (security: no cryptographic material storage)'
              );
              db.deleteObjectStore('partyShares');
            }

            // Remove communicationKeys store (contained private keys)
            if (db.objectStoreNames.contains('communicationKeys')) {
              console.log(
                '🗑️ Removing communicationKeys object store (security: no private key storage)'
              );
              db.deleteObjectStore('communicationKeys');
            }
          }
        },
        blocked() {
          console.warn(
            '⚠️ IndexedDB upgrade blocked - another tab may have the database open'
          );
        },
        blocking() {
          console.warn(
            '⚠️ IndexedDB upgrade blocking - this tab is preventing another tab from upgrading'
          );
        },
      });

      console.log(
        '✅ IndexedDB initialized successfully (production-ready: no cryptographic material storage)'
      );
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

      // Reset the init promise
      this.initPromise = null;

      // Delete the database
      await indexedDB.deleteDatabase(this.dbName);
      console.log('🗑️ Database deleted');

      // Wait a moment for the deletion to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

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
      const db = await this.getDb();
      const requiredStores = [
        'sessions',
        'partyConfigs',
        'partySessions',
        'webhookEvents',
        'walletReconstructions',
      ];

      for (const storeName of requiredStores) {
        if (!db.objectStoreNames.contains(storeName)) {
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

  /**
   * Ensure database is healthy and reset if corrupted
   */
  async ensureDatabaseHealth(): Promise<void> {
    const isValid = await this.validateDatabase();
    if (!isValid) {
      console.log('🔄 Database validation failed, resetting database...');
      await this.resetDatabase();
    }
  }

  // ===== SESSION MANAGEMENT (Non-sensitive metadata only) =====

  async storeSession(sessionData: Omit<SessionData, 'id'>): Promise<any> {
    try {
      const db = await this.getDb();
      const result = await db.add('sessions', {
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Session ${sessionData.sessionId} stored in IndexedDB`);
      return result;
    } catch (error) {
      console.error('❌ Failed to store session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | undefined> {
    try {
      const db = await this.getDb();
      const sessions = await db.getAllFromIndex(
        'sessions',
        'sessionId',
        sessionId
      );
      return sessions[0];
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return undefined;
    }
  }

  async updateSession(
    sessionData: Partial<SessionData> & { sessionId: string }
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const existingSession = await this.getSession(sessionData.sessionId);

      if (existingSession) {
        const updatedSession = {
          ...existingSession,
          ...sessionData,
          updatedAt: new Date(),
        };
        await db.put('sessions', updatedSession);
        console.log(`✅ Session ${sessionData.sessionId} updated in IndexedDB`);
      } else {
        console.warn(
          `⚠️ Session ${sessionData.sessionId} not found for update`
        );
      }
    } catch (error) {
      console.error('❌ Failed to update session:', error);
      throw error;
    }
  }

  async getAllSessions(): Promise<SessionData[]> {
    try {
      const db = await this.getDb();
      const sessions = await db.getAll('sessions');
      // Sort by creation date, newest first
      return sessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to get all sessions:', error);
      return [];
    }
  }

  async getSessionsByStatus(status: string): Promise<SessionData[]> {
    try {
      const db = await this.getDb();
      return await db.getAllFromIndex('sessions', 'status', status);
    } catch (error) {
      console.error('❌ Failed to get sessions by status:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await this.getDb();
      const sessions = await db.getAllFromIndex(
        'sessions',
        'sessionId',
        sessionId
      );
      for (const session of sessions) {
        await db.delete('sessions', session.id);
      }
      console.log(`✅ Session ${sessionId} deleted from IndexedDB`);
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      throw error;
    }
  }

  // ===== PARTY CONFIGURATION =====

  async storePartyConfig(config: Omit<PartyConfig, 'id'>): Promise<any> {
    try {
      const db = await this.getDb();
      const result = await db.add('partyConfigs', {
        ...config,
        initializedAt: new Date(),
      });
      console.log(
        `✅ Party config for Party ${config.partyId} stored in IndexedDB`
      );
      return result;
    } catch (error) {
      console.error('❌ Failed to store party config:', error);
      throw error;
    }
  }

  async getPartyConfig(
    partyId: number,
    sessionId?: string
  ): Promise<PartyConfig | undefined> {
    try {
      const db = await this.getDb();

      if (sessionId) {
        // Get party config for specific session
        const configs = await db.getAllFromIndex(
          'partyConfigs',
          'partySessionId',
          [partyId, sessionId]
        );
        return configs[0];
      } else {
        // Get most recent party config
        const configs = await db.getAllFromIndex(
          'partyConfigs',
          'partyId',
          partyId
        );
        return configs.sort(
          (a, b) =>
            new Date(b.initializedAt).getTime() -
            new Date(a.initializedAt).getTime()
        )[0];
      }
    } catch (error) {
      console.error('❌ Failed to get party config:', error);
      return undefined;
    }
  }

  // ===== PARTY SESSION TRACKING (Non-sensitive) =====

  async storePartySession(session: Omit<PartySessionData, 'id'>): Promise<any> {
    try {
      const db = await this.getDb();
      const result = await db.add('partySessions', {
        ...session,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(
        `✅ Party session for Party ${session.partyId} in session ${session.sessionId} stored`
      );
      return result;
    } catch (error) {
      console.error('❌ Failed to store party session:', error);
      throw error;
    }
  }

  async getPartySession(
    sessionId: string,
    partyId: number
  ): Promise<PartySessionData | undefined> {
    try {
      const db = await this.getDb();
      const sessions = await db.getAllFromIndex(
        'partySessions',
        'sessionParty',
        [sessionId, partyId]
      );
      return sessions[0];
    } catch (error) {
      console.error('❌ Failed to get party session:', error);
      return undefined;
    }
  }

  async updatePartySession(
    sessionId: string,
    partyId: number,
    updates: Partial<PartySessionData>
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const session = await this.getPartySession(sessionId, partyId);
      if (session) {
        const updatedSession = {
          ...session,
          ...updates,
          updatedAt: new Date(),
        };
        await db.put('partySessions', updatedSession);
        console.log(
          `✅ Party session for Party ${partyId} in session ${sessionId} updated`
        );
      } else {
        console.warn(
          `⚠️ Party session not found: Party ${partyId} in session ${sessionId}`
        );
      }
    } catch (error) {
      console.error('❌ Failed to update party session:', error);
      throw error;
    }
  }

  async getAllPartySessions(partyId: number): Promise<PartySessionData[]> {
    try {
      const db = await this.getDb();
      const sessions = await db.getAllFromIndex(
        'partySessions',
        'partyId',
        partyId
      );
      // Sort by creation date, newest first
      return sessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to get party sessions:', error);
      return [];
    }
  }

  // ===== WALLET RECONSTRUCTION TRACKING =====

  async storeWalletReconstruction(
    reconstruction: Omit<WalletReconstructionData, 'id'>
  ): Promise<any> {
    try {
      const db = await this.getDb();

      // Check if a reconstruction already exists for this session
      const existing = await this.getWalletReconstruction(
        reconstruction.sessionId
      );

      if (existing) {
        // Update existing reconstruction
        const result = await db.put('walletReconstructions', {
          ...existing,
          ...reconstruction,
          reconstructionTimestamp: new Date(),
          verified: true,
        });
        console.log(
          `✅ Wallet reconstruction for session ${reconstruction.sessionId} updated`
        );
        return result;
      } else {
        // Create new reconstruction
        const result = await db.add('walletReconstructions', {
          ...reconstruction,
          reconstructionTimestamp: new Date(),
          verified: true,
        });
        console.log(
          `✅ Wallet reconstruction for session ${reconstruction.sessionId} stored`
        );
        return result;
      }
    } catch (error) {
      console.error('❌ Failed to store wallet reconstruction:', error);
      throw error;
    }
  }

  async getWalletReconstruction(
    sessionId: string
  ): Promise<WalletReconstructionData | undefined> {
    try {
      const db = await this.getDb();
      const reconstructions = await db.getAllFromIndex(
        'walletReconstructions',
        'sessionId',
        sessionId
      );
      return reconstructions[0];
    } catch (error) {
      console.error('❌ Failed to get wallet reconstruction:', error);
      return undefined;
    }
  }

  async getAllWalletReconstructions(): Promise<WalletReconstructionData[]> {
    try {
      const db = await this.getDb();
      const reconstructions = await db.getAll('walletReconstructions');
      // Sort by reconstruction date, newest first
      return reconstructions.sort(
        (a, b) =>
          new Date(b.reconstructionTimestamp).getTime() -
          new Date(a.reconstructionTimestamp).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to get wallet reconstructions:', error);
      return [];
    }
  }

  // ===== WEBHOOK EVENT LOGGING (For audit/debugging) =====

  async storeWebhookEvent(
    event: Omit<WebhookEventData, 'id' | 'receivedAt'>
  ): Promise<any> {
    try {
      const db = await this.getDb();
      const eventWithTimestamp = {
        ...event,
        receivedAt: new Date(),
      };
      const result = await db.add('webhookEvents', eventWithTimestamp);
      console.log(
        `✅ Webhook event stored: ${event.event} for Party ${event.partyId}`
      );
      return result;
    } catch (error) {
      console.error('❌ Failed to store webhook event:', error);
      throw error;
    }
  }

  async getPartyWebhookEvents(partyId: number): Promise<WebhookEventData[]> {
    try {
      const db = await this.getDb();
      const events = await db.getAllFromIndex(
        'webhookEvents',
        'partyId',
        partyId
      );
      // Sort by timestamp, newest first
      return events.sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to get party webhook events:', error);
      return [];
    }
  }

  async getSessionWebhookEvents(
    sessionId: string
  ): Promise<WebhookEventData[]> {
    try {
      const db = await this.getDb();
      const events = await db.getAllFromIndex(
        'webhookEvents',
        'sessionId',
        sessionId
      );
      // Sort by timestamp, newest first
      return events.sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to get session webhook events:', error);
      return [];
    }
  }

  // ===== UTILITY METHODS =====

  async clearAllData(): Promise<void> {
    try {
      const db = await this.getDb();
      const tx = db.transaction(
        [
          'sessions',
          'partyConfigs',
          'partySessions',
          'webhookEvents',
          'walletReconstructions',
        ],
        'readwrite'
      );

      await Promise.all([
        tx.objectStore('sessions').clear(),
        tx.objectStore('partyConfigs').clear(),
        tx.objectStore('partySessions').clear(),
        tx.objectStore('webhookEvents').clear(),
        tx.objectStore('walletReconstructions').clear(),
      ]);

      await tx.done;
      console.log('🗑️ All data cleared from IndexedDB');
    } catch (error) {
      console.error('❌ Failed to clear all data:', error);
      throw error;
    }
  }

  async getDatabaseSize(): Promise<{
    sessions: number;
    partyConfigs: number;
    partySessions: number;
    webhookEvents: number;
    walletReconstructions: number;
  }> {
    try {
      const db = await this.getDb();

      const sessions = await db.count('sessions');
      const partyConfigs = await db.count('partyConfigs');
      const partySessions = await db.count('partySessions');
      const webhookEvents = await db.count('webhookEvents');
      const walletReconstructions = await db.count('walletReconstructions');

      return {
        sessions,
        partyConfigs,
        partySessions,
        webhookEvents,
        walletReconstructions,
      };
    } catch (error) {
      console.error('❌ Failed to get database size:', error);
      return {
        sessions: 0,
        partyConfigs: 0,
        partySessions: 0,
        webhookEvents: 0,
        walletReconstructions: 0,
      };
    }
  }

  /**
   * Debug method to view all data (for development only)
   */
  async debugViewAllData(): Promise<any> {
    try {
      const db = await this.getDb();

      const sessions = await db.getAll('sessions');
      const partyConfigs = await db.getAll('partyConfigs');
      const partySessions = await db.getAll('partySessions');
      const webhookEvents = await db.getAll('webhookEvents');
      const walletReconstructions = await db.getAll('walletReconstructions');

      return {
        sessions,
        partyConfigs,
        partySessions,
        webhookEvents,
        walletReconstructions,
        summary: {
          sessionsCount: sessions.length,
          partyConfigsCount: partyConfigs.length,
          partySessionsCount: partySessions.length,
          webhookEventsCount: webhookEvents.length,
          walletReconstructionsCount: walletReconstructions.length,
        },
      };
    } catch (error) {
      console.error('❌ Failed to view all data:', error);
      return null;
    }
  }

  /**
   * Debug method to clear all data (for development only)
   */
  async debugClearAllData(): Promise<void> {
    console.warn('⚠️ Clearing all data from IndexedDB (debug method)');
    await this.clearAllData();
  }
}
