// This file must be imported first to ensure environment variables are loaded
// before any other modules that depend on them
import { config } from 'dotenv';
import { resolve } from 'path';

if (process.env.NODE_ENV !== 'production') {
  // __dirname is backend/src, so we need to go up two levels to reach root .env
  config({ path: resolve(__dirname, '../../.env') });
}
