import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const chatWebhook = env.VITE_N8N_CHAT_WEBHOOK_URL || env.VITE_N8N_BASE_URL || 'https://webhookhml.abainfra.com.br/webhook/one-drive-tst'
  const parsedWebhook = new URL(chatWebhook)
  const webhookPath = parsedWebhook.pathname.replace(/\/+$/, '') || '/'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            msal: ['@azure/msal-browser', '@azure/msal-react'],
            charts: ['recharts'],
            query: ['@tanstack/react-query'],
          }
        }
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api/n8n/chat': {
          target: parsedWebhook.origin,
          changeOrigin: true,
          secure: true,
          rewrite: () => webhookPath,
        },
      },
    },
  }
})
