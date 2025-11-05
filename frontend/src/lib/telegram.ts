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

export function getInitData(): string {
  return telegram.initData || 'dev_mode';
}

export function getUser() {
  return telegram.initDataUnsafe.user;
}
