import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file from parent directory
  const env = loadEnv(mode, '../', '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_DEV_BYPASS_AUTH': JSON.stringify(env.DEV_BYPASS_AUTH || 'false'),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false,
      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.io',
        'localhost',
      ],
      hmr: {
        clientPort: 443,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/webhook': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
  };
});
