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

const isInTelegram = typeof window !== 'undefined' && WebApp?.initData?.length > 0;

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
  ready: () => {},
  expand: () => {},
  close: () => {},
  MainButton: {
    setText: () => {},
    show: () => {},
    hide: () => {},
    onClick: () => {},
  },
};

export const telegram: TelegramWebApp = isInTelegram ? WebApp : mockTelegramWebApp;

if (isInTelegram) {
  telegram.ready();
  telegram.expand();
}

export const getInitData = (): string | null => {
  if (isInTelegram) return telegram.initData;
  if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') return 'dev_mode_bypass';
  return null;
};

export function getUser() {
  return telegram.initDataUnsafe.user;
}
