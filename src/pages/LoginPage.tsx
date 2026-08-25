import React, { useState } from 'react'
import { Shield, Lock, Users, FileSearch, Loader2, CheckCircle, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/ui/Logo'

export function LoginPage() {
  const { login, isLoading, authError, clearAuthError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const features = [
    { icon: <FileSearch size={16} />, label: 'Consulta inteligente de documentos' },
    { icon: <Shield size={16} />, label: 'Controle de acesso por perfil' },
    { icon: <Users size={16} />, label: 'Integração com Active Directory' },
    { icon: <Lock size={16} />, label: 'Conformidade com a LGPD' },
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
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 login-grid opacity-60" />

        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-400/30 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] w-96 h-96 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10">
          <Logo size={44} showWordmark inverted />
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-blue-100/80 text-xs font-medium tracking-[0.22em] uppercase mb-3">
            Plataforma corporativa
          </p>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Consulta inteligente de documentos de RH
          </h1>
          <p className="text-blue-100/90 text-base mb-10 leading-relaxed">
            Pergunte em linguagem natural e encontre o que precisa no OneDrive e no SharePoint,
            com autenticação corporativa e conformidade LGPD.
          </p>

          <div className="space-y-2.5">
            {features.map(feature => (
              <div
                key={feature.label}
                className="flex items-center gap-3 text-blue-50"
              >
                <div className="w-9 h-9 bg-white/15 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  {feature.icon}
                </div>
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-blue-100/70 text-xs tracking-wide">
            Active Directory · n8n · OpenAI
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-violet-500/10 dark:bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-blue-500/10 dark:bg-blue-500/10 blur-3xl" />

        <div className="w-full max-w-[420px] relative z-10">
          <div className="flex lg:hidden mb-8 justify-center">
            <Logo size={40} showWordmark />
          </div>

          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Bem-vindo ao DocRH
            </h2>
            <p className="text-[var(--text-secondary)] mt-1.5 text-sm">
              Entre com suas credenciais do domínio corporativo
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/90 backdrop-blur-sm p-7 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/30">
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                <Lock size={12} />
                Active Directory (LDAP)
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                  Usuário
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="usuario ou email@empresa.com"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                    className="input-field pl-10 text-sm h-11 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    required
                    className="input-field pl-10 text-sm h-11 rounded-xl"
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
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white font-medium rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md shadow-indigo-500/25"
                aria-label="Entrar com credenciais do domínio"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 space-y-2">
              {[
                'Autenticação via LDAP no Active Directory',
                'Grupos do domínio mapeados para perfis',
                'Sessão protegida · Tokens seguros',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 text-center leading-relaxed flex items-start justify-center gap-2">
              <Lock size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                Este sistema está em conformidade com a LGPD.
                Os dados são usados só para autenticação e controle de acesso.
              </span>
            </p>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
            Acesso restrito a colaboradores autorizados.
            <br />
            Em caso de problemas, contate o suporte de TI.
          </p>
        </div>
      </div>
    </div>
  )
}
