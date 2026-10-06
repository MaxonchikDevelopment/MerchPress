import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildId } from './src/lib/buildId.ts';

const gitSha = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
};

const appVersion = (): string => {
  try {
    return String(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version ?? '');
  } catch {
    return '';
  }
};

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __BUILD_ID__: JSON.stringify(buildId(process.env.VERCEL_GIT_COMMIT_SHA, gitSha())),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'sounds/new-order.wav', 'sounds/ready.wav'],
      manifest: {
        name: 'MerchPress Queue',
        short_name: 'MerchPress',
        description: 'Event merch order queue for cashier and press stations',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
