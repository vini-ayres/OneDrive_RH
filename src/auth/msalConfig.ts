import { PublicClientApplication, Configuration, LogLevel, BrowserCacheLocation } from '@azure/msal-browser'

// Configuração do Microsoft Entra ID (Azure AD)
// Substitua os valores abaixo pelas configurações do seu tenant
export const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'YOUR_TENANT_ID_HERE'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_POST_LOGOUT_URI || window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // SEGURANÇA: Usar sessionStorage ao invés de localStorage
    // Tokens nunca são armazenados em localStorage por questões de segurança
    cacheLocation: BrowserCacheLocation.SessionStorage,
    storeAuthStateInCookie: false, // Não usar cookies para auth state no browser
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) return // Nunca logar PII
        if (import.meta.env.DEV) {
          switch (level) {
            case LogLevel.Error:
              console.error('[MSAL]', message)
              break
            case LogLevel.Warning:
              console.warn('[MSAL]', message)
              break
          }
        }
      },
      piiLoggingEnabled: false, // LGPD: nunca logar dados pessoais
    },
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
  },
}

// Escopos necessários para a aplicação
export const LOGIN_SCOPES = {
  // Escopos básicos de autenticação
  openid: 'openid',
  profile: 'profile',
  email: 'email',
  offlineAccess: 'offline_access',
  // Escopos Microsoft Graph
  user: 'User.Read',
  groups: 'GroupMember.Read.All',
  photo: 'User.Read',
}

export const GRAPH_SCOPES = [
  'User.Read',
  'GroupMember.Read.All',
]

export const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
]

// Request de login
export const loginRequest = {
  scopes: DEFAULT_SCOPES,
  prompt: 'select_account' as const,
}

// Request para Microsoft Graph
export const graphRequest = {
  scopes: GRAPH_SCOPES,
}

// Instância MSAL singleton
export const msalInstance = new PublicClientApplication(MSAL_CONFIG)

// Inicializar MSAL (necessário para v3+)
msalInstance.initialize().catch(console.error)

export default msalInstance
