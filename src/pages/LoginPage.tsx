import React, { useState } from 'react'
import { Shield, Lock, Users, FileSearch, Loader2, CheckCircle, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isLocalTestModeEnabled } from '../utils/localTestUser'

export function LoginPage() {
  const { login, loginLocalTestUser, isLoading, authError, clearAuthError } = useAuth()
  const localTestModeEnabled = isLocalTestModeEnabled()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const features = [
    { icon: <FileSearch size={18} />, label: 'Consulta inteligente de documentos' },
    { icon: <Shield size={18} />, label: 'Controle de acesso por perfil (RBAC)' },
    { icon: <Users size={18} />, label: 'Integração com Active Directory corporativo' },
    { icon: <Lock size={18} />, label: 'Conformidade com LGPD' },
  ]

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearAuthError()

    try {
      await login({ username, password })
    } catch {
      // Erro exibido via authError
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Shield size={22} className="text-white" />
            </div>
            <span className="text-white font-semibold text-lg">RH Inteligente</span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Sistema Corporativo de Consulta Documental
          </h1>
          <p className="text-blue-100 text-lg mb-10 leading-relaxed">
            Consulte documentos corporativos com inteligência artificial,
            com autenticação via Active Directory e conformidade LGPD.
          </p>

          <div className="space-y-3">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-blue-100">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-blue-200 text-xs">
            Active Directory · n8n · OpenAI
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={22} className="text-white" />
            </div>
            <span className="font-bold text-xl text-[var(--text-primary)]">RH Inteligente</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Bem-vindo</h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Faça login com suas credenciais do domínio corporativo
            </p>
          </div>

          <div className="card p-8">
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <Lock size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  Active Directory (LDAP)
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                  Usuário
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="usuario ou email@empresa.com"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    required
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{authError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Entrar com credenciais do domínio"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>

            {localTestModeEnabled && (
              <>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Ambiente local
                  </span>
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                </div>

                <button
                  onClick={loginLocalTestUser}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Entrar com usuário de teste local"
                >
                  <CheckCircle size={18} />
                  <span>Entrar com usuário de teste local</span>
                </button>
              </>
            )}

            <div className="mt-6 space-y-2">
              {[
                'Autenticação via LDAP Bind no Active Directory',
                'Grupos do domínio mapeados para perfis de acesso',
                'Sessão protegida · Tokens seguros',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-xs text-blue-700 dark:text-blue-300 text-center leading-relaxed">
              🔒 Este sistema está em conformidade com a Lei Geral de Proteção de Dados (LGPD).
              Seus dados são utilizados exclusivamente para autenticação e controle de acesso.
            </p>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-4">
            Acesso restrito a colaboradores autorizados.
            <br />
            Em caso de problemas, contate o suporte de TI.
          </p>
        </div>
      </div>
    </div>
  )
}
