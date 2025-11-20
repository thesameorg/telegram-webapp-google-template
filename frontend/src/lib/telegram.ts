import WebApp from '@twa-dev/sdk';

const isInTelegram = typeof window !== 'undefined' && WebApp?.initData?.length > 0;

if (isInTelegram) {
  WebApp.ready();
  WebApp.expand();
}

export const getInitData = (): string | null => {
  if (isInTelegram) return WebApp.initData;
  if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') return 'dev_mode_bypass';
  return null;
};

export const getUser = () => WebApp.initDataUnsafe.user;
