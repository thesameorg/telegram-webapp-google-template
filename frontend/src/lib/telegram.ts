import WebApp from '@twa-dev/sdk';

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
}

// Check if running in real Telegram environment
const isInTelegram = typeof window !== 'undefined' && WebApp?.initData?.length > 0;

// Debug logging
if (typeof window !== 'undefined') {
  console.log('🔍 Telegram WebApp Debug:', {
    isInTelegram,
    hasWebApp: !!WebApp,
    initDataLength: WebApp?.initData?.length || 0,
    initDataPreview: WebApp?.initData?.substring(0, 50) || 'none',
  });
}

// Mock Telegram WebApp for development
const mockTelegramWebApp: TelegramWebApp = {
  initData: 'mock_init_data_for_dev',
  initDataUnsafe: {
    user: {
      id: 123456789,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
      language_code: 'en',
    }
  },
  ready: () => console.log('📱 Mock Telegram ready'),
  expand: () => console.log('📱 Mock Telegram expand'),
  close: () => console.log('📱 Mock Telegram close'),
  MainButton: {
    setText: () => {},
    show: () => {},
    hide: () => {},
    onClick: () => {},
  },
};

export const telegram: TelegramWebApp = isInTelegram ? WebApp : mockTelegramWebApp;

// Initialize Telegram WebApp
if (isInTelegram) {
  telegram.ready();
  telegram.expand();
} else {
  console.log('⚠️  Not running in Telegram - using mock data for development');
}

export function getInitData(): string | null {
  console.log('📍 getInitData called:', {
    isInTelegram,
    hasInitData: !!telegram.initData,
    initDataLength: telegram.initData?.length || 0,
    devBypassAuth: import.meta.env.VITE_DEV_BYPASS_AUTH,
  });

  // If in Telegram, always use real initData
  if (isInTelegram) {
    console.log('✅ Using real Telegram initData');
    return telegram.initData;
  }

  // If DEV_BYPASS_AUTH is enabled, return mock data for local development
  const devBypassAuth = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';
  if (devBypassAuth) {
    console.log('⚠️  DEV_BYPASS_AUTH enabled - using mock initData');
    return 'dev_mode_bypass';
  }

  // Not in Telegram and no bypass - auth unavailable
  console.log('❌ No Telegram and no bypass - auth unavailable');
  return null;
}

export function getUser() {
  return telegram.initDataUnsafe.user;
}
