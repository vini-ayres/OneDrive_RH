import React from 'react'
import { Shield, Lock, Users, FileSearch, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useApp } from '../contexts/AppContext'

export function LoginPage() {
  const { login, isLoading } = useAuth()
  const { state } = useApp()
  const { theme } = state

  const features = [
    { icon: <FileSearch size={18} />, label: 'Consulta inteligente de documentos' },
    { icon: <Shield size={18} />, label: 'Controle de acesso por perfil (RBAC)' },
    { icon: <Users size={18} />, label: 'Integração com Azure AD / Microsoft 365' },
    { icon: <Lock size={18} />, label: 'Conformidade com LGPD' },
  ]

  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Content */}
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
            Consulte documentos do Microsoft OneDrive e SharePoint com inteligência artificial, 
            com segurança corporativa e conformidade LGPD.
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
            Powered by Microsoft Azure AD · n8n · OpenAI
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={22} className="text-white" />
            </div>
            <span className="font-bold text-xl text-[var(--text-primary)]">RH Inteligente</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Bem-vindo</h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Faça login com sua conta corporativa Microsoft
            </p>
          </div>

          {/* Login card */}
          <div className="card p-8">
            {/* Microsoft logo */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2">
                <MicrosoftLogo />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  Microsoft Entra ID
                </span>
              </div>
            </div>

            <button
              onClick={login}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-medium hover:bg-[var(--bg-tertiary)] hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Entrar com conta Microsoft"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <MicrosoftLogo />
                  <span>Entrar com Microsoft</span>
                </>
              )}
            </button>

            {/* Security badges */}
            <div className="mt-6 space-y-2">
              {[
                'Autenticação OAuth 2.0 + OpenID Connect',
                'Single Sign-On (SSO) corporativo',
                'Sessão protegida · Tokens seguros',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LGPD notice */}
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

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}
