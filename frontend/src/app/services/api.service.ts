import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  communicationPubKeys?: { partyId: number; publicKey: string }[];
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

export interface DkgRequest {
  blockchain?: string;
}

export interface DkgResponse {
  sessionId: string;
  status: string;
  message: string;
}

export interface SignatureRequest {
  message: string;
}

export interface SignatureResponse {
  sessionId: string;
  status: string;
  message: string;
  messageHash?: string;
}

export interface ReconstructionResponse {
  sessionId: string;
  walletAddress: string;
  sharesCount: number;
  status: string;
  message: string;
}

export interface WebhookLog {
  sessionId: string;
  partyId: number;
  direction: 'inbound' | 'outbound';
  event: string;
  payload?: any;
  success: boolean;
  timestamp: Date;
}

export interface PartyRegistration {
  partyId: number;
  webhookUrl: string;
  walletAddress: string;
  timestamp: string;
}

export interface PartyResponse {
  sessionId: string;
  partyId: number;
  event: string;
  payload: any;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getSessions(): Observable<SessionSummary[]> {
    return this.http
      .get<{
        success: boolean;
        sessions: SessionSummary[];
        count: number;
      }>(`${this.apiUrl}/sessions`)
      .pipe(map((response) => response.sessions));
  }

  getSession(sessionId: string): Observable<Session> {
    return this.http
      .get<{
        success: boolean;
        session: Session;
      }>(`${this.apiUrl}/sessions/${sessionId}`)
      .pipe(map((response) => response.session));
  }

  createSession(
    sessionConfig: any
  ): Observable<{ sessionId: string; status: string; message: string }> {
    return this.http
      .post<{
        success: boolean;
        sessionId: string;
        status: string;
        message: string;
      }>(`${this.apiUrl}/sessions`, sessionConfig)
      .pipe(
        map((response) => ({
          sessionId: response.sessionId,
          status: response.status,
          message: response.message,
        }))
      );
  }

  addCommunicationPublicKey(
    sessionId: string,
    partyId: number,
    publicKey: string
  ): Observable<any> {
    return this.http
      .post<{
        success: boolean;
        message: string;
      }>(
        `${this.apiUrl}/sessions/${sessionId}/parties/${partyId}/communication-key`,
        { publicKey }
      )
      .pipe(map((response) => response));
  }

  initiateDkg(sessionId: string, blockchain?: string): Observable<DkgResponse> {
    const body: DkgRequest = {};

    if (blockchain) body.blockchain = blockchain;

    return this.http
      .post<{
        success: boolean;
        sessionId: string;
        status: string;
        message: string;
      }>(`${this.apiUrl}/sessions/${sessionId}/initiate-dkg`, body)
      .pipe(
        map((response) => ({
          sessionId: response.sessionId,
          status: response.status,
          message: response.message,
        }))
      );
  }

  createSignature(
    sessionId: string,
    message: string
  ): Observable<SignatureResponse> {
    return this.http
      .post<{
        success: boolean;
        sessionId: string;
        status: string;
        message: string;
        messageHash?: string;
      }>(`${this.apiUrl}/sessions/${sessionId}/sign`, { message })
      .pipe(
        map((response) => ({
          sessionId: response.sessionId,
          status: response.status,
          message: response.message,
          messageHash: response.messageHash,
        }))
      );
  }

  reconstructKey(sessionId: string): Observable<ReconstructionResponse> {
    return this.http
      .post<{
        success: boolean;
        sessionId: string;
        walletAddress: string;
        sharesCount: number;
        status: string;
        message: string;
      }>(`${this.apiUrl}/sessions/${sessionId}/reconstruct-key`, {})
      .pipe(
        map((response) => ({
          sessionId: response.sessionId,
          walletAddress: response.walletAddress,
          sharesCount: response.sharesCount,
          status: response.status,
          message: response.message,
        }))
      );
  }

  getWebhookLogs(sessionId: string): Observable<WebhookLog[]> {
    return this.http
      .get<{
        success: boolean;
        logs: WebhookLog[];
        count: number;
      }>(`${this.apiUrl}/webhook-logs/${sessionId}`)
      .pipe(map((response) => response.logs));
  }

  getWebhookEvents(sessionId: string, partyId: number): Observable<any[]> {
    return this.http
      .get<{
        success: boolean;
        events: any[];
      }>(
        `${this.apiUrl}/sessions/${sessionId}/parties/${partyId}/webhook-events`
      )
      .pipe(map((response) => response.events));
  }

  registerParty(registration: PartyRegistration): Observable<any> {
    return this.http
      .post<{
        success: boolean;
        message: string;
      }>(`${this.apiUrl}/parties/register`, registration)
      .pipe(map((response) => response));
  }

  sendPartyResponse(response: PartyResponse): Observable<any> {
    return this.http
      .post<{
        success: boolean;
        message: string;
      }>(
        `${this.apiUrl}/webhook/${response.sessionId}/${response.partyId}`,
        response
      )
      .pipe(map((res) => res));
  }
}
