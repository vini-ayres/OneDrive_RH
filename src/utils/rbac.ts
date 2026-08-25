import { UserRole, Permission, ROLE_PERMISSIONS, ROLE_GROUP_MAP, UserProfile } from '../types'

function groupCn(group: string): string {
  const first = group.split(',')[0]?.trim() || group
  return first.replace(/^CN=/i, '').trim()
}

/**
 * Determina os papéis do usuário baseado nos grupos do Active Directory
 */
export function getRolesFromGroups(groups: string[]): UserRole[] {
  const roles: Set<UserRole> = new Set()
  const map = new Map(
    Object.entries(ROLE_GROUP_MAP).map(([name, role]) => [name.toLowerCase(), role])
  )

  for (const group of groups) {
    const normalized = group.trim()
    if (!normalized) continue
    const role = map.get(normalized.toLowerCase()) || map.get(groupCn(normalized).toLowerCase())
    if (role) roles.add(role)
  }

  if (roles.size === 0) {
    roles.add('colaborador')
  }

  return Array.from(roles)
}

/**
 * Obtém as permissões efetivas do usuário (combinação de todos os papéis)
 */
export function getEffectivePermissions(roles: UserRole[]): Permission {
  if (roles.length === 0) {
    return ROLE_PERMISSIONS.colaborador
  }

  // Combinar permissões - OR lógico (se qualquer papel permite, está permitido)
  const combined: Permission = {
    canViewOwnDocuments: false,
    canViewPublicDocuments: false,
    canViewSharedDocuments: false,
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
  }

  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role]
    if (!perms) continue
    for (const key of Object.keys(combined) as (keyof Permission)[]) {
      if (perms[key]) {
        combined[key] = true
      }
    }
  }

  return combined
}

/**
 * Verifica se o usuário tem uma permissão específica
 */
export function hasPermission(user: UserProfile | null, permission: keyof Permission): boolean {
  if (!user) return false
  const perms = getEffectivePermissions(user.roles)
  return perms[permission]
}

/**
 * Verifica se o usuário tem pelo menos um dos papéis especificados
 */
export function hasRole(user: UserProfile | null, ...roles: UserRole[]): boolean {
  if (!user) return false
  return roles.some(role => user.roles.includes(role))
}

/**
 * Obtém o papel mais privilegiado do usuário
 */
export function getHighestRole(roles: UserRole[]): UserRole {
  const hierarchy: UserRole[] = ['admin', 'diretoria', 'rh', 'gestor', 'colaborador']
  for (const role of hierarchy) {
    if (roles.includes(role)) return role
  }
  return 'colaborador'
}

/**
 * Retorna label legível para o papel
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    diretoria: 'Diretoria',
    rh: 'Recursos Humanos',
    gestor: 'Gestor',
    colaborador: 'Colaborador',
  }
  return labels[role] || role
}

/**
 * Retorna cor do badge para o papel
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'badge-red',
    diretoria: 'badge-purple',
    rh: 'badge-blue',
    gestor: 'badge-green',
    colaborador: 'badge-yellow',
  }
  return colors[role] || 'badge-yellow'
}

/**
 * Verifica se uma query é permitida para o perfil do usuário
 * Retorna null se permitida, ou string com motivo do bloqueio
 */
export function checkQueryPermission(
  query: string,
  user: UserProfile
): string | null {
  const perms = getEffectivePermissions(user.roles)
  const lowerQuery = query.toLowerCase()

  // Verificar acesso a dados financeiros/salários
  const salaryKeywords = ['salário', 'salario', 'holerite', 'contracheque', 'remuneração', 'remuneracao', 'folha de pagamento']
  if (salaryKeywords.some(kw => lowerQuery.includes(kw))) {
    if (!perms.canViewHolerites) {
      return 'Acesso negado: Você não tem permissão para consultar informações salariais.'
    }
  }

  // Verificar acesso a contratos
  const contractKeywords = ['contrato', 'admissão', 'admissao', 'demissão', 'demissao', 'rescisão', 'rescisao']
  if (contractKeywords.some(kw => lowerQuery.includes(kw))) {
    if (!perms.canViewContratos && !perms.canViewDocumentosAdmissionais) {
      return 'Acesso negado: Você não tem permissão para consultar contratos e documentos demissionais.'
    }
  }

  // Verificar acesso a documentos confidenciais
  const confidentialKeywords = ['confidencial', 'restrito', 'sigiloso', 'privado']
  if (confidentialKeywords.some(kw => lowerQuery.includes(kw))) {
    if (!perms.canViewDocumentosConfidenciais) {
      return 'Acesso negado: Você não tem permissão para acessar documentos confidenciais.'
    }
  }

  return null // Permitido
}
