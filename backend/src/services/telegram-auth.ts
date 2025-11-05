import type { TelegramUser } from '../types';

export class TelegramAuthService {
  private readonly botToken: string;
  private readonly maxAge: number;

  constructor(botToken: string, maxAge: number = 3600) {
    if (!botToken) {
      throw new Error('Bot token required');
    }
    this.botToken = botToken;
    this.maxAge = maxAge; // seconds
  }

  /**
   * Validates Telegram WebApp initData
   * Returns validated user object
   */
  async validateInitData(initData: string): Promise<TelegramUser> {
    if (!initData) {
      throw new Error('initData is required');
    }

    // Step 1: Extract hash
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      throw new Error('Missing hash in initData');
    }

    // Step 2: Build data_check_string
    urlParams.delete('hash');
    const sortedParams = Array.from(urlParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    const dataCheckString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Step 3-4: Validate signature
    const isValid = await this.validateSignature(dataCheckString, hash);
    if (!isValid) {
      throw new Error('Invalid initData signature');
    }

    // Step 5: Check auth_date
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > this.maxAge) {
      throw new Error('initData expired');
    }

    // Step 6: Parse user
    const userParam = urlParams.get('user');
    if (!userParam) {
      throw new Error('Missing user in initData');
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      return this.validateUser(user);
    } catch (error) {
      throw new Error('Invalid user data in initData');
    }
  }

  /**
   * Validates HMAC signature using Web Crypto API
   */
  private async validateSignature(
    data: string,
    receivedHash: string
  ): Promise<boolean> {
    try {
      // Step 1: secret_key = HMAC-SHA256("WebAppData", bot_token)
      const encoder = new TextEncoder();

      const webAppDataKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode('WebAppData'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const secretKeyData = await crypto.subtle.sign(
        'HMAC',
        webAppDataKey,
        encoder.encode(this.botToken)
      );

      const secretKey = await crypto.subtle.importKey(
        'raw',
        secretKeyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // Step 2: expected_hash = HMAC-SHA256(data_check_string, secret_key)
      const signatureData = await crypto.subtle.sign(
        'HMAC',
        secretKey,
        encoder.encode(data)
      );

      const expectedHash = Array.from(new Uint8Array(signatureData))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Step 3: Compare hashes (constant-time comparison)
      return receivedHash === expectedHash;
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  /**
   * Validates user object structure
   */
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
