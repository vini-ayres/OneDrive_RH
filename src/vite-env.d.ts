/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_BASE_URL?: string
  readonly VITE_N8N_CHAT_WEBHOOK_URL?: string
  readonly VITE_AUTH_API_URL?: string
  readonly VITE_SESSION_TIMEOUT_MINUTES?: string
  readonly VITE_APP_ENV?: string
  readonly VITE_ENABLE_LOCAL_TEST_USER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
