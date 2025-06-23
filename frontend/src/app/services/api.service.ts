import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Party {
  name: string;
  webhookUrl: string;
}

export interface Session {
  _id: string;
  sessionId: string;
  status: string;
  operation: string;
  messageHash?: string;
  signature?: string;
  finalSignature?: any;
  secret?: string;
  parties: Array<{
    partyId: number;
    partyName: string;
    status: string;
    lastSeen?: Date;
  }>;
  metadata: {
    walletAddress?: string;
    blockchain?: string;
    message?: string;
    description?: string;
  };
  createdAt: Date;
  expiresAt: Date;
  communicationPubKeys?: { partyId: number, publicKey: string }[];
}

export interface SessionSummary {
  sessionId: string;
  status: string;
  operation: string;
  parties: number;
  readyParties: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface KeyGenerationRequest {
  walletAddress: string;
  blockchain?: string;
}

export interface KeyGenerationResponse {
  sessionId: string;
  walletAddress: string;
  blockchain: string;
  status: string;
  message: string;
}

export interface SignatureRequest {
  message: string;
}

export interface SignatureResponse {
  sessionId: string;
  signature: string;
  messageHash: string;
  message: string;
  participants: number[];
  status: string;
}

export interface WebhookLog {
  sessionId: string;
  partyId: number;
  direction: 'inbound' | 'outbound';
  event: string;
  url?: string;
  method?: string;
  requestBody?: any;
  responseBody?: any;
  statusCode?: number;
  headers?: any;
  responseHeaders?: any;
  duration?: number;
  success: boolean;
  error?: {
    message: string;
    code: string;
    stack: string;
  };
  retryCount: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:3000/api'; // Point to the correct backend server

  constructor(private http: HttpClient) { }

  getSessions(): Observable<Session[]> {
    return this.http.get<{success: boolean, sessions: Session[], count: number}>(`${this.apiUrl}/sessions`)
      .pipe(
        map(response => response.sessions)
      );
  }

  getSession(sessionId: string): Observable<Session> {
    return this.http.get<{success: boolean, session: Session}>(`${this.apiUrl}/sessions/${sessionId}`)
      .pipe(
        map(response => response.session)
      );
  }

  createSession(sessionConfig: any): Observable<Session> {
    return this.http.post<{success: boolean, sessionId: string, status: string, message: string}>(`${this.apiUrl}/sessions`, sessionConfig)
      .pipe(
        map(response => ({ sessionId: response.sessionId, status: response.status } as Session))
      );
  }

  addCommunicationPublicKey(sessionId: string, partyId: number, publicKey: string): Observable<Session> {
    return this.http.post<{success: boolean, session: Session}>(`${this.apiUrl}/sessions/${sessionId}/parties/${partyId}/communication-key`, { publicKey })
      .pipe(
        map(response => response.session)
      );
  }

  joinSession(sessionId: string, walletAddress: string): Observable<any> {
    return this.http.post<{success: boolean, partyId: number, status: string}>(`${this.apiUrl}/sessions/${sessionId}/join`, { walletAddress })
      .pipe(
        map(response => response)
      );
  }

  generateKey(sessionId: string, walletAddress?: string, blockchain?: string): Observable<any> {
    const body: any = {};
    if (walletAddress) body.walletAddress = walletAddress;
    if (blockchain) body.blockchain = blockchain;
    
    return this.http.post<{success: boolean, message: string}>(`${this.apiUrl}/sessions/${sessionId}/generate-key`, body)
      .pipe(
        map(response => response)
      );
  }

  reconstructKey(sessionId: string): Observable<any> {
    return this.http.post<{success: boolean, sessionId: string, walletAddress: string, privateKey: string, status: string}>(`${this.apiUrl}/sessions/${sessionId}/reconstruct-key`, {})
      .pipe(
        map(response => response)
      );
  }

  createSignature(sessionId: string, message: string): Observable<any> {
    return this.http.post<{success: boolean, signature: string, digest: string}>(`${this.apiUrl}/sessions/${sessionId}/sign`, { message })
      .pipe(
        map(response => response)
      );
  }

  getWebhookLogs(sessionId: string): Observable<WebhookLog[]> {
    return this.http.get<{success: boolean, logs: WebhookLog[], count: number}>(`${this.apiUrl}/webhook-logs/${sessionId}`)
      .pipe(
        map(response => response.logs)
      );
  }

  getWebhookEvents(sessionId: string, partyId: number): Observable<any[]> {
    return this.http.get<{success: boolean, events: any[]}>(`${this.apiUrl}/sessions/${sessionId}/parties/${partyId}/webhook-events`)
      .pipe(
        map(response => response.events)
      );
  }
} 