/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/jungdeungbu/',
  plugins: [react()],
  // firebase(auth+firestore, 오프라인 캐시 포함)만으로 약 800kB. 서비스 워커 없이 한 번에 받는 편이 오프라인에 낫다.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
})
