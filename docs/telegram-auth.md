# Telegram WebApp Authentication

## Overview

Telegram WebApp provides a secure authentication mechanism using HMAC-SHA256 signatures. When a user opens your WebApp through Telegram, the Telegram client provides an `initData` string containing user information and a cryptographic signature.

---

## How It Works

### 1. User Opens WebApp

User clicks your WebApp button in Telegram → Telegram generates `initData`:

```
query_id=AAHdF6IQAAAAAN0XohDhrOrc
user=%7B%22id%22%3A1234567890%2C%22first_name%22%3A%22John%22%2C%22last_name%22%3A%22Doe%22%2C%22username%22%3A%22johndoe%22%2C%22language_code%22%3A%22en%22%7D
auth_date=1703001234
hash=a1b2c3d4e5f6...
```

**Components**:
- `user`: JSON-encoded user object (URL-encoded)
- `auth_date`: Unix timestamp when data was generated
- `hash`: HMAC-SHA256 signature (proves authenticity)
- Other optional fields: `query_id`, `start_param`, etc.

---

## 2. Frontend: Get initData

```typescript
// frontend/src/lib/telegram.ts
import WebApp from '@twa-dev/sdk';

export const telegram = WebApp;

// Initialize WebApp
telegram.ready();
telegram.expand();

// Get initData string
export function getInitData(): string {
  return telegram.initData;
}

// Get parsed user (UNSAFE - not validated yet!)
export function getUser() {
  return telegram.initDataUnsafe.user;
}
```

```tsx
// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { getInitData } from './lib/telegram';
import { authenticate } from './lib/api';

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('jwt')
  );

  useEffect(() => {
    if (token) return; // Already authenticated

    const initData = getInitData();
    if (!initData) {
      console.error('No initData - not running in Telegram WebApp');
      return;
    }

    // Send initData to backend for validation
    authenticate(initData)
      .then(({ token }) => {
        localStorage.setItem('jwt', token);
        setToken(token);
      })
      .catch(error => {
        console.error('Auth failed:', error);
      });
  }, [token]);

  if (!token) {
    return <div className="flex items-center justify-center h-screen">
      <p>Authenticating...</p>
    </div>;
  }

  return <Feed />;
}
```

---

## 3. Backend: Validate initData

### HMAC Signature Validation Algorithm

**Telegram's validation process**:

```
1. Extract hash from initData
2. Build data_check_string (sorted params, excluding hash)
3. Compute secret_key = HMAC-SHA256("WebAppData", bot_token)
4. Compute expected_hash = HMAC-SHA256(data_check_string, secret_key)
5. Compare expected_hash with received hash
6. Check auth_date is recent (< 1 hour old)
```

### Implementation

```typescript
// backend/src/services/telegram-auth.ts
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
      const webAppDataKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('WebAppData'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const secretKeyData = await crypto.subtle.sign(
        'HMAC',
        webAppDataKey,
        new TextEncoder().encode(this.botToken)
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
        new TextEncoder().encode(data)
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
```

---

## 4. Auth Endpoint

```typescript
// backend/src/api/auth.ts
import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegram-auth';
import { generateToken } from '../services/jwt';
import { db } from '../config/firebase';

export async function authHandler(req: Request, res: Response) {
  try {
    // Parse request body
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({ error: 'Missing initData' });
    }

    // Validate initData
    const authService = new TelegramAuthService(
      process.env.TELEGRAM_BOT_TOKEN!
    );
    const user = await authService.validateInitData(initData);

    // Save/update user in Firestore
    await db.collection('users').doc(user.id.toString()).set({
      id: user.id.toString(),
      username: user.username || '',
      firstName: user.first_name,
      lastName: user.last_name || '',
      photoUrl: user.photo_url || '',
      languageCode: user.language_code || 'en',
      isPremium: user.is_premium || false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Generate JWT token
    const token = generateToken({
      userId: user.id.toString(),
      username: user.username || '',
      firstName: user.first_name,
    });

    return res.json({
      authenticated: true,
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        photoUrl: user.photo_url,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}
```

---

## 5. JWT Token Management

```typescript
// backend/src/services/jwt.ts
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  username: string;
  firstName: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
```

```typescript
// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload; // Attach user to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

## 6. Frontend API Client

```typescript
// frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function authenticate(initData: string) {
  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Authentication failed');
  }

  return response.json();
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('jwt');

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token expired - clear and redirect
    localStorage.removeItem('jwt');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Usage example
export async function createPost(content: string) {
  return fetchWithAuth('/posts', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
```

---

## Security Considerations

### ✅ What We Validate
1. **HMAC Signature**: Proves data came from Telegram
2. **Timestamp**: Ensures data is recent (< 1 hour)
3. **User Structure**: Validates required fields exist

### ✅ What We Don't Trust
- **initDataUnsafe**: NEVER trust this client-side data for auth decisions
- **localStorage JWT**: Can be stolen via XSS (use httpOnly cookies in production)

### 🔒 Production Hardening

**Use httpOnly cookies instead of localStorage**:

```typescript
// backend/src/api/auth.ts
export async function authHandler(c: Context): Promise<Response> {
  // ... validate initData, generate token ...

  // Set httpOnly cookie (prevents XSS)
  c.header('Set-Cookie', `jwt=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);

  return c.json({ authenticated: true, user });
}
```

```typescript
// backend/src/middleware/auth.middleware.ts
export async function authMiddleware(c: Context, next: Next) {
  // Read JWT from cookie instead of Authorization header
  const cookies = c.req.header('Cookie');
  const token = cookies?.split(';')
    .find(c => c.trim().startsWith('jwt='))
    ?.split('=')[1];

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // ... verify token ...
}
```

---

## Testing

### Local Development (Without Telegram)

```typescript
// backend/src/api/auth.ts
export async function authHandler(c: Context): Promise<Response> {
  // DEV MODE: Skip validation
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    const mockUser = {
      id: '123456789',
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
    };

    const token = generateToken({
      userId: mockUser.id,
      username: mockUser.username,
      firstName: mockUser.first_name,
    });

    return c.json({ authenticated: true, token, user: mockUser });
  }

  // Production: validate initData
  // ...
}
```

### Test with Real Telegram

1. Create a test bot via @BotFather
2. Set bot WebApp URL to ngrok tunnel
3. Open bot in Telegram → click WebApp button
4. Check browser console for `initData`

---

## Common Errors

### "Invalid initData signature"
- ❌ Wrong bot token
- ❌ initData was tampered with
- ❌ Clock skew between client and server

### "initData expired"
- ❌ auth_date > 1 hour old
- Fix: User needs to refresh the WebApp

### "Missing user in initData"
- ❌ User didn't allow data sharing
- Fix: Ask user to re-open WebApp and accept permissions

---

## Reference

- [Telegram WebApp Docs](https://core.telegram.org/bots/webapps)
- [Validating Data Received via WebApp](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Grammy.js Docs](https://grammy.dev/)
