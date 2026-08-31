export type UserRole = 'colaborador' | 'gestor' | 'rh' | 'diretoria' | 'admin'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string
  roles: UserRole[]
  groups: string[]
  jobTitle?: string
  department?: string
  officeLocation?: string
  mobilePhone?: string
}

export const ROLE_GROUP_MAP: Record<string, UserRole> = {
  'RH-Sistema-Diretoria': 'diretoria',
  'RH-Sistema-RH': 'rh',
  'RH-Sistema-Gestores': 'gestor',
  'RH-Sistema-Colaboradores': 'colaborador',
  GRP_docrh_consulta: 'colaborador',
  GRP_docrh_admin: 'admin',
}

function groupCn(group: string): string {
  const first = group.split(',')[0]?.trim() || group
  return first.replace(/^CN=/i, '').trim()
}

export function getRolesFromGroups(groups: string[]): UserRole[] {
  const roles = new Set<UserRole>()
  const map = new Map(
    Object.entries(ROLE_GROUP_MAP).map(([name, role]) => [name.toLowerCase(), role])
  )

  for (const group of groups) {
    const normalized = group.trim()
    if (!normalized) continue
    const role = map.get(normalized.toLowerCase()) || map.get(groupCn(normalized).toLowerCase())
    if (role) roles.add(role)
  }

  if (roles.size === 0) roles.add('colaborador')
  return Array.from(roles)
}

export interface Permission {
  canViewAuditLog: boolean
  canViewDashboard: boolean
  canExportData: boolean
  canManageUsers: boolean
}

const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  colaborador: { canViewAuditLog: false, canViewDashboard: false, canExportData: false, canManageUsers: false },
  gestor: { canViewAuditLog: false, canViewDashboard: true, canExportData: false, canManageUsers: false },
  rh: { canViewAuditLog: true, canViewDashboard: true, canExportData: true, canManageUsers: false },
  diretoria: { canViewAuditLog: true, canViewDashboard: true, canExportData: true, canManageUsers: false },
  admin: { canViewAuditLog: true, canViewDashboard: true, canExportData: true, canManageUsers: true },
}

export function getEffectivePermissions(roles: UserRole[]): Permission {
  const combined: Permission = {
    canViewAuditLog: false,
    canViewDashboard: false,
    canExportData: false,
    canManageUsers: false,
  }

  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role]
    if (!perms) continue
    for (const key of Object.keys(combined) as (keyof Permission)[]) {
      if (perms[key]) combined[key] = true
    }
  }

  return combined
}

export function hasPermission(user: AuthUser, permission: keyof Permission): boolean {
  return getEffectivePermissions(user.roles)[permission]
}

export function getHighestRole(roles: UserRole[]): UserRole {
  const hierarchy: UserRole[] = ['admin', 'diretoria', 'rh', 'gestor', 'colaborador']
  for (const role of hierarchy) {
    if (roles.includes(role)) return role
  }
  return 'colaborador'
}
