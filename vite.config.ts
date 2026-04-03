import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return process.env.BUILD_SOURCEVERSION?.substring(0, 7) || 'unknown'
  }
})()

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_NUMBER__: JSON.stringify(process.env.BUILD_BUILDNUMBER || 'local'),
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3001',
      '/logout': 'http://localhost:3001',
    },
  },
})
