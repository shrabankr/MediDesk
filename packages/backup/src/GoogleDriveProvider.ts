import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from '@medidesk/shared';

export interface GoogleDriveTokens {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number; // epoch ms
  accountEmail?: string;
}

export interface GoogleDriveFileMetadata {
  fileId: string;
  name: string;
  sizeBytes: number;
  createdTime: Date;
  sha256Checksum?: string;
  webViewLink?: string;
}

export interface GoogleDriveQuota {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
}

export interface IGoogleDriveProvider {
  isConnected(): boolean;
  isOnline(): Promise<boolean>;
  setTokens(tokens: GoogleDriveTokens): void;
  getTokens(): GoogleDriveTokens;
  disconnect(): void;
  authorize(authCode: string, redirectUri?: string): Promise<GoogleDriveTokens>;
  refreshAccessToken(): Promise<string>;
  uploadEncryptedBackup(
    backupPath: string,
    backupId: string,
    metadata: { organizationId: string; sizeBytes: number; sha256Checksum: string },
    onProgress?: (percent: number) => void
  ): Promise<{ fileId: string; webViewLink?: string; sha256Checksum?: string }>;
  downloadEncryptedBackup(fileId: string, destinationPath: string, onProgress?: (percent: number) => void): Promise<string>;
  listBackups(folderName?: string): Promise<GoogleDriveFileMetadata[]>;
  deleteBackup(fileId: string): Promise<boolean>;
  checkQuota(): Promise<GoogleDriveQuota>;
}

export class GoogleDriveProvider implements IGoogleDriveProvider {
  private clientId?: string;
  private clientSecret?: string;
  private tokens: GoogleDriveTokens = {};
  private logger: Logger;
  private forceOffline = false;
  private mockRemoteStorage: Map<string, { buffer: Buffer; metadata: GoogleDriveFileMetadata }> = new Map();

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    this.logger = new Logger('GoogleDriveProvider');
  }

  public setForceOffline(offline: boolean): void {
    this.forceOffline = offline;
  }

  public isConnected(): boolean {
    return Boolean(this.tokens.accessToken || this.tokens.refreshToken);
  }

  public setTokens(tokens: GoogleDriveTokens): void {
    this.tokens = { ...this.tokens, ...tokens };
  }

  public getTokens(): GoogleDriveTokens {
    return { ...this.tokens };
  }

  public disconnect(): void {
    this.tokens = {};
    this.logger.info('Google Drive disconnected.');
  }

  public async isOnline(): Promise<boolean> {
    if (this.forceOffline) return false;

    // Check internet connectivity by querying Google API endpoint with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://www.googleapis.com/discovery/v1/apis?preferred=true', {
        method: 'HEAD',
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);
      return res !== null;
    } catch {
      return false;
    }
  }

  public async authorize(authCode: string, redirectUri = 'http://localhost:5173/oauth2callback'): Promise<GoogleDriveTokens> {
    if (this.forceOffline) {
      throw new Error('Network error: Internet is unavailable for Google Drive authentication.');
    }

    if (!this.clientId || !this.clientSecret) {
      // Mock authorization for test environment without live credentials
      this.logger.info(`Simulating Google Drive OAuth authorization for code: ${authCode.substring(0, 8)}...`);
      const tokens: GoogleDriveTokens = {
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
        expiryDate: Date.now() + 3600 * 1000,
        accountEmail: 'clinic-admin@gmail.com'
      };
      this.setTokens(tokens);
      return tokens;
    }

    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        code: authCode,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google OAuth authorization failed (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const tokens: GoogleDriveTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.tokens.refreshToken,
        expiryDate: Date.now() + ((data.expires_in || 3600) * 1000),
        accountEmail: data.id_token ? this.extractEmailFromIdToken(data.id_token) : 'connected-account'
      };

      this.setTokens(tokens);
      return tokens;
    } catch (err) {
      this.logger.error(`OAuth token exchange failed: ${(err as Error).message}`);
      throw err;
    }
  }

  public async refreshAccessToken(): Promise<string> {
    if (!this.tokens.refreshToken) {
      throw new Error('No refresh token available. Re-authentication required.');
    }

    if (this.forceOffline) {
      throw new Error('Network error: Internet is unavailable for token refresh.');
    }

    if (!this.clientId || !this.clientSecret) {
      const newAccess = `mock-refreshed-token-${Date.now()}`;
      this.tokens.accessToken = newAccess;
      this.tokens.expiryDate = Date.now() + 3600 * 1000;
      return newAccess;
    }

    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token'
      });

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!res.ok) {
        throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
      }

      const data = await res.json() as any;
      this.tokens.accessToken = data.access_token;
      this.tokens.expiryDate = Date.now() + ((data.expires_in || 3600) * 1000);
      return data.access_token;
    } catch (err) {
      this.logger.error(`Google Drive token refresh failed: ${(err as Error).message}`);
      throw err;
    }
  }

  public async uploadEncryptedBackup(
    backupPath: string,
    backupId: string,
    metadata: { organizationId: string; sizeBytes: number; sha256Checksum: string },
    onProgress?: (percent: number) => void
  ): Promise<{ fileId: string; webViewLink?: string; sha256Checksum?: string }> {
    if (this.forceOffline) {
      throw new Error('Upload failed: Internet is offline.');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file to upload not found: ${backupPath}`);
    }

    const filename = path.basename(backupPath);
    const fileBuffer = fs.readFileSync(backupPath);

    // Verify it's an encrypted artifact
    if (fileBuffer.subarray(0, 15).toString('utf8') !== 'MEDIDESK_ENC_V1') {
      throw new Error('Security violation: Attempted to upload unencrypted SQLite database.');
    }

    // Check duplicate prevention: is this exact backupId already uploaded?
    const existingList = await this.listBackups();
    const existing = existingList.find(b => b.name === filename || b.name.includes(backupId));
    if (existing) {
      this.logger.info(`Duplicate prevention: Backup ${backupId} already exists on Google Drive (${existing.fileId}).`);
      return {
        fileId: existing.fileId,
        webViewLink: existing.webViewLink,
        sha256Checksum: existing.sha256Checksum || metadata.sha256Checksum
      };
    }

    if (onProgress) onProgress(25);

    // If no live credentials, store in memory / mock container
    if (!this.clientId || !this.tokens.accessToken) {
      const fileId = `gdrive-file-${crypto.randomUUID()}`;
      const mockMeta: GoogleDriveFileMetadata = {
        fileId,
        name: filename,
        sizeBytes: fileBuffer.length,
        createdTime: new Date(),
        sha256Checksum: metadata.sha256Checksum,
        webViewLink: `https://drive.google.com/file/d/${fileId}/view`
      };

      this.mockRemoteStorage.set(fileId, { buffer: fileBuffer, metadata: mockMeta });
      if (onProgress) onProgress(100);
      return { fileId, webViewLink: mockMeta.webViewLink, sha256Checksum: metadata.sha256Checksum };
    }

    // Real Google Drive API v3 Multipart Upload
    try {
      const boundary = `-------314159265358979323846`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const fileMetadata = {
        name: filename,
        mimeType: 'application/octet-stream',
        description: `MediDesk Encrypted Backup [${backupId}]`,
        properties: {
          backupId,
          organizationId: metadata.organizationId,
          sha256: metadata.sha256Checksum,
          encryption: 'AES-256-GCM-SCRYPT-V1'
        }
      };

      const multipartBody = Buffer.concat([
        Buffer.from(
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(fileMetadata) +
          delimiter +
          'Content-Type: application/octet-stream\r\n\r\n'
        ),
        fileBuffer,
        Buffer.from(closeDelimiter)
      ]);

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink,md5Checksum';
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.tokens.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length.toString()
        },
        body: multipartBody
      });

      if (response.status === 401) {
        // Token expired, attempt refresh once
        await this.refreshAccessToken();
        return this.uploadEncryptedBackup(backupPath, backupId, metadata, onProgress);
      }

      if (response.status === 403) {
        throw new Error('Google Drive quota exceeded or insufficient permissions.');
      }

      if (!response.ok) {
        throw new Error(`Google Drive upload failed (${response.status}): ${await response.text()}`);
      }

      const result = await response.json() as any;
      if (onProgress) onProgress(100);

      return {
        fileId: result.id,
        webViewLink: result.webViewLink,
        sha256Checksum: metadata.sha256Checksum
      };
    } catch (err) {
      this.logger.error(`Google Drive upload failed: ${(err as Error).message}`);
      throw err;
    }
  }

  public async downloadEncryptedBackup(
    fileId: string,
    destinationPath: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    if (this.forceOffline) {
      throw new Error('Download failed: Internet is offline.');
    }

    if (onProgress) onProgress(20);

    // Mock storage retrieval
    if (this.mockRemoteStorage.has(fileId)) {
      const item = this.mockRemoteStorage.get(fileId)!;
      fs.writeFileSync(destinationPath, item.buffer);
      if (onProgress) onProgress(100);
      return destinationPath;
    }

    if (!this.tokens.accessToken) {
      throw new Error('Google Drive access token missing. Please connect account.');
    }

    try {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` }
      });

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.downloadEncryptedBackup(fileId, destinationPath, onProgress);
      }

      if (!response.ok) {
        throw new Error(`Google Drive download failed (${response.status}): ${await response.text()}`);
      }

      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      fs.writeFileSync(destinationPath, buffer);

      if (onProgress) onProgress(100);
      return destinationPath;
    } catch (err) {
      this.logger.error(`Google Drive download error: ${(err as Error).message}`);
      throw err;
    }
  }

  public async listBackups(_folderName?: string): Promise<GoogleDriveFileMetadata[]> {
    if (this.forceOffline) return [];

    // Return mock storage items if active
    const results: GoogleDriveFileMetadata[] = [];
    for (const item of this.mockRemoteStorage.values()) {
      results.push(item.metadata);
    }

    if (!this.tokens.accessToken) {
      return results;
    }

    try {
      const query = encodeURIComponent("mimeType = 'application/octet-stream' and trashed = false and name contains 'medidesk'");
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,webViewLink,properties)&pageSize=50`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` }
      });

      if (!response.ok) {
        return results;
      }

      const data = await response.json() as any;
      const apiFiles: GoogleDriveFileMetadata[] = (data.files || []).map((f: any) => ({
        fileId: f.id,
        name: f.name,
        sizeBytes: parseInt(f.size || '0', 10),
        createdTime: new Date(f.createdTime),
        sha256Checksum: f.properties?.sha256,
        webViewLink: f.webViewLink
      }));

      return [...results, ...apiFiles];
    } catch {
      return results;
    }
  }

  public async deleteBackup(fileId: string): Promise<boolean> {
    if (this.mockRemoteStorage.has(fileId)) {
      this.mockRemoteStorage.delete(fileId);
      return true;
    }

    if (!this.tokens.accessToken) return true;

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` }
      });
      return res.ok || res.status === 404;
    } catch {
      return false;
    }
  }

  public async checkQuota(): Promise<GoogleDriveQuota> {
    if (!this.tokens.accessToken || this.forceOffline) {
      return { totalBytes: 15 * 1024 * 1024 * 1024, usedBytes: 1024 * 1024 * 100, availableBytes: 14 * 1024 * 1024 * 1024 };
    }

    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        const q = data.storageQuota;
        const limit = parseInt(q.limit || '0', 10);
        const usage = parseInt(q.usage || '0', 10);
        return {
          totalBytes: limit || 15 * 1024 * 1024 * 1024,
          usedBytes: usage,
          availableBytes: limit ? limit - usage : 15 * 1024 * 1024 * 1024
        };
      }
    } catch { /* fallback */ }

    return { totalBytes: 15 * 1024 * 1024 * 1024, usedBytes: 0, availableBytes: 15 * 1024 * 1024 * 1024 };
  }

  private extractEmailFromIdToken(idToken: string): string {
    try {
      const parts = idToken.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return payload.email || 'connected-account';
      }
    } catch { /* ignore */ }
    return 'connected-account';
  }
}
