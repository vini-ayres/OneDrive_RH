import React, { useState } from 'react'
import { 
  Menu, Bell, Sun, Moon, LogOut, User, 
  Shield, Clock, ChevronDown, Settings
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'
import { RoleBadge } from '../ui/Badge'
import { SESSION_TIMEOUT_MINUTES } from '../../contexts/AppContext'
import { getHighestRole } from '../../utils/rbac'

export function Header() {
  const { state, dispatch } = useApp()
  const { logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const { user, theme, sidebarOpen, sessionExpiresAt } = state

  const toggleTheme = () => {
    dispatch({ type: 'SET_THEME', payload: theme === 'light' ? 'dark' : 'light' })
  }

  const toggleSidebar = () => {
    dispatch({ type: 'SET_SIDEBAR', payload: !sidebarOpen })
  }

  // Calcular tempo restante de sessão
  const getSessionTimeRemaining = (): string => {
    if (!sessionExpiresAt) return `${SESSION_TIMEOUT_MINUTES}m`
    const remaining = Math.max(0, Math.floor((sessionExpiresAt.getTime() - Date.now()) / 60000))
    if (remaining <= 0) return 'Expirada'
    if (remaining < 5) return `${remaining}m ⚠️`
    return `${remaining}m`
  }

  const sessionTimeClass = () => {
    if (!sessionExpiresAt) return 'text-green-600 dark:text-green-400'
    const remaining = Math.floor((sessionExpiresAt.getTime() - Date.now()) / 60000)
    if (remaining < 5) return 'text-red-500 animate-pulse'
    if (remaining < 10) return 'text-yellow-500'
    return 'text-green-600 dark:text-green-400'
  }

  const highestRole = user ? getHighestRole(user.roles) : null

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] z-40 sticky top-0">
      {/* Left: Logo + Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="btn-ghost p-2"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          {/* Logo / Ícone do sistema */}
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
              RH Inteligente
            </h1>
            <p className="text-xs text-[var(--text-muted)] leading-tight">
              Consulta Documental
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions + Profile */}
      <div className="flex items-center gap-2">
        {/* Timer de sessão */}
        {user && (
          <div className={`hidden sm:flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-[var(--bg-tertiary)] ${sessionTimeClass()}`}>
            <Clock size={12} />
            <span>{getSessionTimeRemaining()}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost p-2"
          aria-label="Alternar tema"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button className="btn-ghost p-2 relative" aria-label="Notificações">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Profile dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
            >
              <Avatar src={user.photoUrl} name={user.displayName} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-[var(--text-primary)] leading-tight max-w-[120px] truncate">
                  {user.displayName}
                </p>
                {highestRole && (
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight capitalize">
                    {highestRole === 'rh' ? 'RH' : highestRole}
                  </p>
                )}
              </div>
              <ChevronDown size={14} className="text-[var(--text-muted)] hidden md:block" />
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                  {/* Profile header */}
                  <div className="p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <Avatar src={user.photoUrl} name={user.displayName} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                        {user.jobTitle && (
                          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                            {user.jobTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {user.department && (
                      <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                        <span className="w-4 h-4 inline-flex items-center justify-center">🏢</span>
                        {user.department}
                      </p>
                    )}
                    {/* Badges de papel */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.roles.map(role => (
                        <RoleBadge key={role} role={role} />
                      ))}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_VIEW', payload: 'settings' })
                        setShowProfileMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                      <Settings size={15} />
                      Configurações
                    </button>
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_VIEW', payload: 'chat' })
                        setShowProfileMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                      <User size={15} />
                      Meu Perfil
                    </button>
                    <hr className="my-2 border-[var(--border-color)]" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        logout()
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <LogOut size={15} />
                      Sair
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
