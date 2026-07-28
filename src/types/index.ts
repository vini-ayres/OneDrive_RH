// Tipos de perfis/papéis no sistema RBAC
export type UserRole = 'colaborador' | 'gestor' | 'rh' | 'diretoria' | 'admin'

// Permissões granulares
export interface Permission {
  canViewOwnDocuments: boolean
  canViewPublicDocuments: boolean
  canViewSharedDocuments: boolean
  canViewTeamDocuments: boolean
  canViewHolerites: boolean
  canViewContratos: boolean
  canViewDocumentosAdmissionais: boolean
  canViewDocumentosDemissionais: boolean
  canViewDocumentosConfidenciais: boolean
  canViewAuditLog: boolean
  canViewDashboard: boolean
  canExportData: boolean
  canManageUsers: boolean
}

// Perfil do usuário autenticado
export interface UserProfile {
  id: string
  username: string
  displayName: string
  email: string
  jobTitle: string
  department: string
  officeLocation: string
  mobilePhone: string
  photoUrl?: string
  roles: UserRole[]
  groups: string[]
  accessToken: string
  sessionStart: Date
  lastActivity: Date
}

// Mensagem do chat
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  sources?: DocumentSource[]
  status: 'sending' | 'sent' | 'error' | 'blocked'
  processingSteps?: ProcessingStep[]
}

// Fonte de documento citada na resposta
export interface DocumentSource {
  id: string
  name: string
  path: string
  modifiedAt: Date
  webUrl: string
  type: string
  relevanceScore?: number
  excerpt?: string
}

// Etapa de processamento (mostrada ao usuário)
export interface ProcessingStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  timestamp?: Date
}

// Conversa do chat
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  isFavorite: boolean
  userId: string
}

// Registro de auditoria
export interface AuditLog {
  id: string
  userId: string
  userName: string
  userEmail: string
  action: string
  query: string
  documentAccessed?: string
  documentPath?: string
  result: 'success' | 'blocked' | 'error' | 'denied'
  ipAddress: string
  userAgent: string
  timestamp: Date
  sessionId: string
  role: UserRole
  metadata?: Record<string, string>
}

// Filtros de auditoria
export interface AuditFilters {
  userId?: string
  startDate?: Date
  endDate?: Date
  result?: string
  queryType?: string
  documentName?: string
}

// Estatísticas do dashboard
export interface DashboardStats {
  queriesToday: number
  activeUsers: number
  documentsAccessed: number
  blockedQueries: number
  deniedAccess: number
  totalQueriesMonth: number
  avgResponseTime: number
}

// Dados para gráficos
export interface ChartDataPoint {
  date: string
  queries: number
  users: number
  blocked: number
}

export interface UserQueryData {
  userName: string
  queries: number
  email: string
}

export interface DocumentAccessData {
  documentName: string
  accesses: number
  type: string
}

export interface SecurityEvent {
  date: string
  denied: number
  blocked: number
  errors: number
}

// Resposta da API n8n
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  requestId?: string
  timestamp: string
}

// Payload para envio de chat
export interface ChatPayload {
  query: string
  userId: string
  userName: string
  userEmail: string
  userGroups: string[]
  userRoles: UserRole[]
  conversationId?: string
  context?: ChatMessage[]
  accessToken: string
  metadata: {
    ipAddress: string
    userAgent: string
    sessionId: string
    timestamp: string
  }
}

// Resposta do chat da API
export interface ChatApiResponse {
  answer: string
  sources: DocumentSource[]
  processingSteps: ProcessingStep[]
  blockedReason?: string
  wasBlocked: boolean
  requestId: string
  processingTimeMs: number
}

// Configurações da aplicação
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'pt-BR' | 'en-US'
  sessionTimeout: number // minutos
  notificationsEnabled: boolean
  n8nBaseUrl: string
  authApiUrl: string
}

// Estado da aplicação
export interface AppState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  currentConversation: Conversation | null
  conversations: Conversation[]
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  activeView: 'chat' | 'audit' | 'dashboard' | 'settings' | 'documents'
  sessionExpiresAt: Date | null
}

// Grupos do Active Directory mapeados para roles
export const ROLE_GROUP_MAP: Record<string, UserRole> = {
  // Substitua pelos nomes reais dos grupos no domínio AD
  'RH-Sistema-Diretoria': 'diretoria',
  'RH-Sistema-RH': 'rh',
  'RH-Sistema-Gestores': 'gestor',
  'RH-Sistema-Colaboradores': 'colaborador',
}

// Permissões por papel
export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  colaborador: {
    canViewOwnDocuments: true,
    canViewPublicDocuments: true,
    canViewSharedDocuments: true,
    canViewTeamDocuments: false,
    canViewHolerites: false,
    canViewContratos: false,
    canViewDocumentosAdmissionais: false,
    canViewDocumentosDemissionais: false,
    canViewDocumentosConfidenciais: false,
    canViewAuditLog: false,
    canViewDashboard: false,
    canExportData: false,
    canManageUsers: false,
  },
  gestor: {
    canViewOwnDocuments: true,
    canViewPublicDocuments: true,
    canViewSharedDocuments: true,
    canViewTeamDocuments: true,
    canViewHolerites: false,
    canViewContratos: false,
    canViewDocumentosAdmissionais: false,
    canViewDocumentosDemissionais: false,
    canViewDocumentosConfidenciais: false,
    canViewAuditLog: false,
    canViewDashboard: true,
    canExportData: false,
    canManageUsers: false,
  },
  rh: {
    canViewOwnDocuments: true,
    canViewPublicDocuments: true,
    canViewSharedDocuments: true,
    canViewTeamDocuments: true,
    canViewHolerites: true,
    canViewContratos: true,
    canViewDocumentosAdmissionais: true,
    canViewDocumentosDemissionais: true,
    canViewDocumentosConfidenciais: false,
    canViewAuditLog: true,
    canViewDashboard: true,
    canExportData: true,
    canManageUsers: false,
  },
  diretoria: {
    canViewOwnDocuments: true,
    canViewPublicDocuments: true,
    canViewSharedDocuments: true,
    canViewTeamDocuments: true,
    canViewHolerites: true,
    canViewContratos: true,
    canViewDocumentosAdmissionais: true,
    canViewDocumentosDemissionais: true,
    canViewDocumentosConfidenciais: true,
    canViewAuditLog: true,
    canViewDashboard: true,
    canExportData: true,
    canManageUsers: true,
  },
  admin: {
    canViewOwnDocuments: true,
    canViewPublicDocuments: true,
    canViewSharedDocuments: true,
    canViewTeamDocuments: true,
    canViewHolerites: true,
    canViewContratos: true,
    canViewDocumentosAdmissionais: true,
    canViewDocumentosDemissionais: true,
    canViewDocumentosConfidenciais: true,
    canViewAuditLog: true,
    canViewDashboard: true,
    canExportData: true,
    canManageUsers: true,
  },
}
