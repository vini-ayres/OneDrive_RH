import React from 'react'
import {
  Settings, User, Shield, Globe, Key,
  Lock, Clock, FolderOpen, FileText, LayoutDashboard,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Avatar } from '../components/ui/Avatar'
import { RoleBadge } from '../components/ui/Badge'
import { getHighestRole, getRoleLabel, hasPermission } from '../utils/rbac'
import { SESSION_TIMEOUT_MINUTES } from '../contexts/AppContext'

export function SettingsPage() {
  const { state, dispatch } = useApp()
  const { user, theme, sessionExpiresAt } = state

  const highestRole = user ? getHighestRole(user.roles) : 'colaborador'
  const canViewExecutiveReports =
    hasPermission(user, 'canViewAuditLog') && hasPermission(user, 'canViewDashboard')

  if (!user) return null

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings size={20} />
            Configurações
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Preferências da interface e informações da sua conta
          </p>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <User size={15} />
            Perfil corporativo
          </h3>
          <div className="flex items-start gap-4">
            <Avatar src={user.photoUrl} name={user.displayName} size="xl" />
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-[var(--text-primary)]">{user.displayName}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
              {user.jobTitle && (
                <p className="text-sm text-[var(--text-muted)] mt-1">{user.jobTitle}</p>
              )}
              {user.department && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{user.department}</p>
              )}
              {user.officeLocation && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{user.officeLocation}</p>
              )}
              {user.mobilePhone && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{user.mobilePhone}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {user.roles.map(role => (
                  <RoleBadge key={role} role={role} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[var(--text-muted)] font-medium">Usuário do domínio</p>
              <p className="text-[var(--text-secondary)] font-mono mt-0.5 truncate">{user.username || user.email}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Perfil de acesso</p>
              <p className="text-[var(--text-secondary)] mt-0.5">{getRoleLabel(highestRole)}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Sessão iniciada</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                {user.sessionStart.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Sessão expira</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                {sessionExpiresAt
                  ? sessionExpiresAt.toLocaleString('pt-BR')
                  : `${SESSION_TIMEOUT_MINUTES} min de inatividade`}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Globe size={15} />
            Aparência
          </h3>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] block mb-2">
              Tema
            </label>
            <div className="flex gap-3">
              {(['light', 'dark'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => dispatch({ type: 'SET_THEME', payload: t })}
                  className={`flex-1 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    theme === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  {t === 'light' ? 'Claro' : 'Escuro'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Shield size={15} />
            Segurança e sessão
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Lock size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Token de sessão</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Emitido pelo backend após o login no Active Directory
                  </p>
                </div>
              </div>
              <span className="badge-green">Protegido</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Clock size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Timeout de inatividade</p>
                  <p className="text-xs text-[var(--text-muted)]">A sessão é encerrada automaticamente</p>
                </div>
              </div>
              <span className="badge-blue">{SESSION_TIMEOUT_MINUTES} minutos</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <FolderOpen size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Dados por usuário</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Conversas, auditoria e documentos recentes ficam isolados da sua conta
                  </p>
                </div>
              </div>
              <span className="badge-green">Isolado</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2 gap-3">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Sanitização de conteúdo</p>
                <p className="text-xs text-[var(--text-muted)]">Consultas e respostas passam por filtro XSS</p>
              </div>
              <span className="badge-green">Ativo</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2 gap-3">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Conformidade LGPD</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Dados usados só para autenticação, consulta e auditoria
                </p>
              </div>
              <span className="badge-green">Conforme</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Key size={15} />
            Permissões do perfil
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Definidas pelos grupos do Active Directory ({getRoleLabel(highestRole)}).
            Não é possível alterar permissões por aqui.
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between py-2 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <FileText size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Consulta de documentos</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Qualquer pessoa com acesso ao sistema pode consultar qualquer arquivo.
                    Não há restrição por tipo, departamento ou classificação de documento.
                  </p>
                </div>
              </div>
              <span className="badge-green flex-shrink-0">Liberado</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-start justify-between py-2 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <LayoutDashboard size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Auditoria e Dashboard Executivo</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Relatório das consultas feitas pelos usuários do sistema.
                    Disponível somente para administradores.
                  </p>
                </div>
              </div>
              <span className={`flex-shrink-0 ${canViewExecutiveReports ? 'badge-green' : 'badge-blue'}`}>
                {canViewExecutiveReports ? 'Liberado' : 'Somente admin'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
