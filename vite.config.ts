/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/jungdeungbu/',
  plugins: [react()],
  // 화면 수정으로 Firebase SDK 청크가 바뀌지 않게 분리한다. 라우트는 계속 정적 import한다.
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'firebase', test: /node_modules[\\/](?:@firebase|firebase)[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
})
