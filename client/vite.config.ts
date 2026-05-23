import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` 設為 '/Yield/' 是為了部署到 GitHub Pages (https://benden-npi.github.io/Yield/)。
// 本機開發時 Vite 仍會正常從根路徑提供資源。
export default defineConfig({
  base: '/Yield/',
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: true,
  },
  preview: {
    port: 5188,
    strictPort: true,
  },
})
