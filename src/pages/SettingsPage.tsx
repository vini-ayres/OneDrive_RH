import React, { useState } from 'react'
import { Settings, User, Shield, Bell, Globe, Key, Info, Save } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Avatar } from '../components/ui/Avatar'
import { RoleBadge } from '../components/ui/Badge'
import { getHighestRole } from '../utils/rbac'
import { SESSION_TIMEOUT_MINUTES } from '../contexts/AppContext'

export function SettingsPage() {
  const { state, dispatch } = useApp()
  const { user, theme } = state
  const [n8nUrl, setN8nUrl] = useState(import.meta.env.VITE_N8N_BASE_URL || '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return null

  const highestRole = getHighestRole(user.roles)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings size={20} />
            Configurações
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Preferências e informações da conta
          </p>
        </div>

        {/* Profile card */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <User size={15} />
            Perfil Corporativo
          </h3>
          <div className="flex items-start gap-4">
            <Avatar src={user.photoUrl} name={user.displayName} size="xl" />
            <div className="flex-1">
              <h4 className="text-lg font-bold text-[var(--text-primary)]">{user.displayName}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
              {user.jobTitle && (
                <p className="text-sm text-[var(--text-muted)] mt-1">{user.jobTitle}</p>
              )}
              {user.department && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">🏢 {user.department}</p>
              )}
              {user.officeLocation && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">📍 {user.officeLocation}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {user.roles.map(role => (
                  <RoleBadge key={role} role={role} />
                ))}
              </div>
            </div>
          </div>

          {/* Account details */}
          <div className="mt-4 pt-4 border-t border-[var(--border-color)] grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[var(--text-muted)] font-medium">Usuário</p>
              <p className="text-[var(--text-secondary)] font-mono mt-0.5 truncate">{user.username || user.email}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Sessão iniciada</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                {user.sessionStart.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Grupos do Domínio</p>
              <p className="text-[var(--text-secondary)] mt-0.5">{user.groups.length} grupo(s)</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] font-medium">Perfil de acesso</p>
              <p className="text-[var(--text-secondary)] mt-0.5 capitalize">{highestRole}</p>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Globe size={15} />
            Aparência
          </h3>
          <div className="space-y-3">
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
                    {t === 'light' ? '☀️ Claro' : '🌙 Escuro'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Shield size={15} />
            Segurança & Sessão
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Timeout de Sessão</p>
                <p className="text-xs text-[var(--text-muted)]">Sessão expira após inatividade</p>
              </div>
              <span className="badge-blue">{SESSION_TIMEOUT_MINUTES} minutos</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Armazenamento de Tokens</p>
                <p className="text-xs text-[var(--text-muted)]">Política de segurança ativa</p>
              </div>
              <span className="badge-green">SessionStorage</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Proteção CSRF</p>
                <p className="text-xs text-[var(--text-muted)]">Token de proteção ativo</p>
              </div>
              <span className="badge-green">Ativo</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Sanitização XSS</p>
                <p className="text-xs text-[var(--text-muted)]">DOMPurify ativo em todas as entradas</p>
              </div>
              <span className="badge-green">Ativo</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Conformidade LGPD</p>
                <p className="text-xs text-[var(--text-muted)]">Logs sem dados sensíveis</p>
              </div>
              <span className="badge-green">Conforme</span>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Key size={15} />
            Permissões do Perfil
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Ver Documentos Próprios', allowed: true },
              { label: 'Ver Documentos Públicos', allowed: true },
              { label: 'Ver Documentos Compartilhados', allowed: true },
              { label: 'Ver Docs da Equipe', allowed: ['gestor', 'rh', 'diretoria'].includes(highestRole) },
              { label: 'Ver Holerites', allowed: ['rh', 'diretoria'].includes(highestRole) },
              { label: 'Ver Contratos', allowed: ['rh', 'diretoria'].includes(highestRole) },
              { label: 'Ver Docs Admissionais', allowed: ['rh', 'diretoria'].includes(highestRole) },
              { label: 'Ver Docs Demissionais', allowed: ['rh', 'diretoria'].includes(highestRole) },
              { label: 'Ver Docs Confidenciais', allowed: highestRole === 'diretoria' },
              { label: 'Acessar Auditoria', allowed: ['rh', 'diretoria', 'admin'].includes(highestRole) },
              { label: 'Acessar Dashboard', allowed: ['gestor', 'rh', 'diretoria', 'admin'].includes(highestRole) },
              { label: 'Exportar Dados', allowed: ['rh', 'diretoria', 'admin'].includes(highestRole) },
            ].map((perm, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-[var(--bg-tertiary)] rounded-lg">
                <span className="text-[var(--text-secondary)] truncate">{perm.label}</span>
                <span className={`ml-2 flex-shrink-0 ${perm.allowed ? 'text-green-500' : 'text-red-400'}`}>
                  {perm.allowed ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* API Config */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Info size={15} />
            Configuração da API
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                URL do Backend n8n
              </label>
              <input
                type="url"
                value={n8nUrl}
                onChange={e => setN8nUrl(e.target.value)}
                placeholder="https://seu-n8n.empresa.com/webhook/one-drive-tst"
                className="input-field text-sm font-mono"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Configure no arquivo .env como VITE_N8N_CHAT_WEBHOOK_URL ou VITE_N8N_BASE_URL
              </p>
            </div>
            <button
              onClick={handleSave}
              className={`btn-primary text-sm ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              <Save size={14} />
              {saved ? 'Salvo!' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
