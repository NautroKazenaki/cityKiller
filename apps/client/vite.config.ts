import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Относительные пути к ассетам — нужно для загрузки сборки в Electron через file://
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      // Берём исходники shared напрямую — vite сам компилирует TS,
      // а изменения движка подхватываются без пересборки пакета
      '@citykiller/shared': path.resolve(process.cwd(), '../../packages/shared/src/index.ts'),
    },
  },
})
