import React from 'react'
import { UserRole } from '../../types'
import { getRoleLabel, getRoleBadgeColor } from '../../utils/rbac'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'
  className?: string
}

const variantMap = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantMap[variant]} ${className}`}>
      {children}
    </span>
  )
}

interface RoleBadgeProps {
  role: UserRole
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const colorClass = getRoleBadgeColor(role)
  const variantMap2: Record<string, BadgeProps['variant']> = {
    'badge-blue': 'blue',
    'badge-green': 'green',
    'badge-red': 'red',
    'badge-yellow': 'yellow',
    'badge-purple': 'purple',
  }
  const variant = variantMap2[colorClass] || 'default'

  return <Badge variant={variant}>{getRoleLabel(role)}</Badge>
}
