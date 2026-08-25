export type UserRole = 'colaborador' | 'gestor' | 'rh' | 'diretoria' | 'admin'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string
  roles: UserRole[]
  groups: string[]
}

export interface Permission {
  canViewAuditLog: boolean
  canViewDashboard: boolean
  canExportData: boolean
}

const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  colaborador: { canViewAuditLog: false, canViewDashboard: false, canExportData: false },
  gestor: { canViewAuditLog: false, canViewDashboard: true, canExportData: false },
  rh: { canViewAuditLog: true, canViewDashboard: true, canExportData: true },
  diretoria: { canViewAuditLog: true, canViewDashboard: true, canExportData: true },
  admin: { canViewAuditLog: true, canViewDashboard: true, canExportData: true },
}

export function getEffectivePermissions(roles: UserRole[]): Permission {
  const combined: Permission = {
    canViewAuditLog: false,
    canViewDashboard: false,
    canExportData: false,
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
