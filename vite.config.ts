import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const chatWebhook = env.VITE_N8N_CHAT_WEBHOOK_URL || env.VITE_N8N_BASE_URL || 'https://webhook.abainfra.com.br/webhook/one-drive-tst'
  const parsedWebhook = new URL(chatWebhook)
  const webhookPath = parsedWebhook.pathname.replace(/\/+$/, '') || '/'

  const uploadWebhook =
    env.VITE_N8N_UPLOAD_WEBHOOK_URL ||
    `${parsedWebhook.origin}/webhook/upload-onedrive`
  const parsedUploadWebhook = new URL(uploadWebhook)
  const uploadWebhookPath = parsedUploadWebhook.pathname.replace(/\/+$/, '') || '/'

  const authApiUrl = env.VITE_AUTH_API_URL || 'http://localhost:8787/api/auth'
  const authApiIsRelative = authApiUrl.startsWith('/')
  const parsedAuth = authApiIsRelative ? null : new URL(authApiUrl)
  const authTarget = authApiIsRelative
    ? (env.VITE_AUTH_API_TARGET || env.VITE_DATA_API_TARGET || 'http://127.0.0.1:8787')
    : parsedAuth!.origin
  const authPathPrefix = authApiIsRelative
    ? '/api/auth'
    : (parsedAuth!.pathname.replace(/\/+$/, '') || '/api/auth')

  const dataApiUrl = env.VITE_DATA_API_URL || 'http://localhost:8787/api'
  const dataApiIsRelative = dataApiUrl.startsWith('/')
  const parsedDataApi = dataApiIsRelative
    ? null
    : new URL(dataApiUrl)
  const dataApiTarget = dataApiIsRelative
    ? (env.VITE_DATA_API_TARGET || 'http://127.0.0.1:8787')
    : parsedDataApi!.origin
  // O frontend chama `/api/data/*`; a API Hono expõe as rotas em `/api/*`.
  const backendApiPath = dataApiIsRelative
    ? '/api'
    : (parsedDataApi!.pathname.replace(/\/+$/, '') || '/api')

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
        '/api/n8n/upload': {
          target: parsedUploadWebhook.origin,
          changeOrigin: true,
          secure: true,
          rewrite: () => uploadWebhookPath,
        },
        '/api/auth': {
          target: authTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/auth/, authPathPrefix),
        },
        '/api/data': {
          target: dataApiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/data/, backendApiPath),
        },
      },
    },
  }
})
