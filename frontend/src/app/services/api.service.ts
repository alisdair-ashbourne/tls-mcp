import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Party {
  name: string;
  webhookUrl: string;
}

export interface Session {
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
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Session Management
  createSession(operation: string, parties: Party[], metadata?: any): Observable<{ success: boolean; sessionId: string; status: string; message: string }> {
    return this.http.post<{ success: boolean; sessionId: string; status: string; message: string }>(
      `${this.baseUrl}/sessions`,
      { operation, parties, metadata }
    );
  }

  getSessions(status?: string, limit?: number): Observable<{ success: boolean; sessions: SessionSummary[]; count: number }> {
    let params = '';
    if (status) params += `status=${status}`;
    if (limit) params += params ? `&limit=${limit}` : `limit=${limit}`;
    
    return this.http.get<{ success: boolean; sessions: SessionSummary[]; count: number }>(
      `${this.baseUrl}/sessions${params ? '?' + params : ''}`
    );
  }

  getSession(sessionId: string): Observable<{ success: boolean; session: Session }> {
    return this.http.get<{ success: boolean; session: Session }>(
      `${this.baseUrl}/sessions/${sessionId}`
    );
  }

  // Key Generation
  generateKey(sessionId: string, request: KeyGenerationRequest): Observable<{ success: boolean } & KeyGenerationResponse> {
    return this.http.post<{ success: boolean } & KeyGenerationResponse>(
      `${this.baseUrl}/sessions/${sessionId}/generate-key`,
      request
    );
  }

  // Key Reconstruction
  reconstructKey(sessionId: string): Observable<{ success: boolean; sessionId: string; walletAddress: string; privateKey: string; status: string }> {
    return this.http.post<{ success: boolean; sessionId: string; walletAddress: string; privateKey: string; status: string }>(
      `${this.baseUrl}/sessions/${sessionId}/reconstruct-key`,
      {}
    );
  }

  // Signature Creation
  createSignature(sessionId: string, request: SignatureRequest): Observable<{ success: boolean } & SignatureResponse> {
    return this.http.post<{ success: boolean } & SignatureResponse>(
      `${this.baseUrl}/sessions/${sessionId}/sign`,
      request
    );
  }

  // Webhook Logs
  getWebhookLogs(sessionId: string, limit?: number): Observable<{ success: boolean; logs: WebhookLog[]; count: number }> {
    const params = limit ? `?limit=${limit}` : '';
    return this.http.get<{ success: boolean; logs: WebhookLog[]; count: number }>(
      `${this.baseUrl}/webhook-logs/${sessionId}${params}`
    );
  }

  // Health Check
  getHealth(): Observable<{ status: string; timestamp: string; uptime: number; environment: string }> {
    return this.http.get<{ status: string; timestamp: string; uptime: number; environment: string }>(
      'http://localhost:3000/health'
    );
  }

  // Party Response (for testing)
  sendPartyResponse(sessionId: string, partyId: number, event: string, payload: any): Observable<{ success: boolean; sessionStatus: string }> {
    return this.http.post<{ success: boolean; sessionStatus: string }>(
      `${this.baseUrl}/webhook/${sessionId}/${partyId}`,
      { event, payload }
    );
  }
} 