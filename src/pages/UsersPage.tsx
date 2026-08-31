import React, { useEffect, useMemo, useState } from 'react'
import { Users, Search, Shield, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { fetchMfaAdminUsers, resetUserMfa, type MfaAdminUser } from '../services/authService'
import { RoleBadge } from '../components/ui/Badge'

export function UsersPage() {
  const { state } = useApp()
  const accessToken = state.user?.accessToken || ''
  const currentUserId = state.user?.id
  const [users, setUsers] = useState<MfaAdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      setUsers(await fetchMfaAdminUsers(accessToken))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [accessToken])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      [user.username, user.displayName, user.email, user.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [users, query])

  const handleReset = async (userId: string) => {
    if (!accessToken) return
    setResettingId(userId)
    setError(null)
    try {
      await resetUserMfa(accessToken, userId)
      setConfirmId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível resetar o MFA.')
    } finally {
      setResettingId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users size={20} />
            Usuários e MFA
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Resetar o autenticador exige confirmação de identidade pelo suporte de TI, fora do sistema.
          </p>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, usuário ou e-mail"
                className="input-field pl-9 h-10 text-sm rounded-xl"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium px-3 py-2 rounded-xl border border-[var(--border-color)]"
            >
              Atualizar
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle size={14} className="text-red-500 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12 text-[var(--text-muted)]">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <th className="py-2 pr-3 font-medium">Usuário</th>
                    <th className="py-2 pr-3 font-medium">Perfil</th>
                    <th className="py-2 pr-3 font-medium">MFA</th>
                    <th className="py-2 pr-3 font-medium">Backups</th>
                    <th className="py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const isSelf = user.id === currentUserId
                    return (
                      <tr key={user.id} className="border-b border-[var(--border-color)] last:border-0">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-[var(--text-primary)]">{user.displayName || user.username}</p>
                          <p className="text-xs text-[var(--text-muted)] font-mono">{user.username}</p>
                          {user.email && <p className="text-xs text-[var(--text-muted)]">{user.email}</p>}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <RoleBadge key={role} role={role} />
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={user.mfaEnabled ? 'badge-green' : 'badge-yellow'}>
                            {user.mfaEnabled ? 'Ativo' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-secondary)]">
                          {user.backupCodesRemaining}
                        </td>
                        <td className="py-3 text-right">
                          {isSelf ? (
                            <span className="text-xs text-[var(--text-muted)]">Troque em Configurações</span>
                          ) : confirmId === user.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                className="text-xs px-2 py-1 rounded-lg border border-[var(--border-color)]"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={resettingId === user.id}
                                onClick={() => void handleReset(user.id)}
                                className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                {resettingId === user.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                Confirmar reset
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!user.mfaEnabled}
                              onClick={() => setConfirmId(user.id)}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                            >
                              Resetar MFA
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)] flex items-start gap-2">
          <Shield size={14} className="mt-0.5 flex-shrink-0" />
          <p>
            Depois do reset, o colaborador cai no cadastro obrigatório no próximo login.
            Se o último administrador também perder o MFA, use no servidor:
            <code className="block mt-1 font-mono text-[var(--text-secondary)]">npm run mfa:reset --prefix server -- usuario</code>
          </p>
        </div>
      </div>
    </div>
  )
}
