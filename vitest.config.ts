import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      app: resolve(__dirname, './src/app'),
      views: resolve(__dirname, './src/views'),
      widgets: resolve(__dirname, './src/widgets'),
      features: resolve(__dirname, './src/features'),
      entities: resolve(__dirname, './src/entities'),
      shared: resolve(__dirname, './src/shared'),
      // Fix for next-auth / next.js imports in test env
      // 'next/server': resolve(__dirname, 'node_modules/next/server.js'),
    },
  },
})
