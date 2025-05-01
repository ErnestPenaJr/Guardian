import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import history from 'connect-history-api-fallback'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3001',
    },
    middlewareMode: false,
    setupMiddlewares: (middlewares) => {
      middlewares.use(history());
      return middlewares;
    },
  },
})
