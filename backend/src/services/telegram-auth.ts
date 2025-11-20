import type { TelegramUser } from '../types';

const HMAC_CONFIG = { name: 'HMAC', hash: 'SHA-256' } as const;
const ENCODER = new TextEncoder();

export class TelegramAuthService {
  constructor(
    private readonly botToken: string,
    private readonly maxAge: number = 3600
  ) {
    if (!botToken) throw new Error('Bot token required');
  }

  async validateInitData(initData: string): Promise<TelegramUser> {
    if (!initData) throw new Error('initData is required');

    const urlParams = new URLSearchParams(initData);
    const hash = this.extractHash(urlParams);
    const dataCheckString = this.buildDataCheckString(urlParams);

    await this.verifySignature(dataCheckString, hash);
    this.verifyAuthDate(urlParams);

    return this.parseUser(urlParams);
  }

  private extractHash(urlParams: URLSearchParams): string {
    const hash = urlParams.get('hash');
    if (!hash) throw new Error('Missing hash in initData');
    urlParams.delete('hash');
    return hash;
  }

  private buildDataCheckString(urlParams: URLSearchParams): string {
    return Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  private async verifySignature(data: string, receivedHash: string): Promise<void> {
    const isValid = await this.validateSignature(data, receivedHash);
    if (!isValid) throw new Error('Invalid initData signature');
  }

  private verifyAuthDate(urlParams: URLSearchParams): void {
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > this.maxAge) throw new Error('initData expired');
  }

  private parseUser(urlParams: URLSearchParams): TelegramUser {
    const userParam = urlParams.get('user');
    if (!userParam) throw new Error('Missing user in initData');

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      return this.validateUser(user);
    } catch {
      throw new Error('Invalid user data in initData');
    }
  }

  private async validateSignature(data: string, receivedHash: string): Promise<boolean> {
    try {
      const secretKey = await this.deriveSecretKey();
      const expectedHash = await this.computeHMAC(secretKey, data);
      return receivedHash === expectedHash;
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  private async deriveSecretKey(): Promise<CryptoKey> {
    const webAppDataKey = await crypto.subtle.importKey(
      'raw',
      ENCODER.encode('WebAppData'),
      HMAC_CONFIG,
      false,
      ['sign']
    );

    const secretKeyData = await crypto.subtle.sign(
      'HMAC',
      webAppDataKey,
      ENCODER.encode(this.botToken)
    );

    return crypto.subtle.importKey('raw', secretKeyData, HMAC_CONFIG, false, ['sign']);
  }

  private async computeHMAC(key: CryptoKey, data: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', key, ENCODER.encode(data));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private validateUser(user: any): TelegramUser {
    if (!user.id || typeof user.id !== 'number') {
      throw new Error('Invalid user.id');
    }
    if (!user.first_name || typeof user.first_name !== 'string') {
      throw new Error('Invalid user.first_name');
    }

    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code,
      is_premium: user.is_premium,
      photo_url: user.photo_url,
    };
  }
}
