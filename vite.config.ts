import { defineConfig } from 'vite';
export default defineConfig({ base: './', assetsInclude: ['**/*.mid'], build: { chunkSizeWarningLimit: 1200 } });
