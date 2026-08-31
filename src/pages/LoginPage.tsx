import React, { useState } from 'react'
import {
  Shield, Lock, Users, FileSearch, Loader2, CheckCircle, User, AlertCircle,
  Smartphone, KeyRound, Copy, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/ui/Logo'
import { QrCode } from '../components/ui/QrCode'
import type { MfaEnrollmentStart } from '../services/authService'
import type { UserProfile } from '../types'

type LoginStep = 'credentials' | 'enroll' | 'challenge' | 'backup'

export function LoginPage() {
  const {
    beginLogin,
    beginEnrollment,
    finishEnrollment,
    finishChallenge,
    applySession,
    isLoading,
    authError,
    clearAuthError,
  } = useAuth()

  const [step, setStep] = useState<LoginStep>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [enrollment, setEnrollment] = useState<MfaEnrollmentStart | null>(null)
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null)
  const [savedCodes, setSavedCodes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const features = [
    { icon: <FileSearch size={16} />, label: 'Consulta inteligente de documentos' },
    { icon: <Shield size={16} />, label: 'Controle de acesso por perfil' },
    { icon: <Users size={16} />, label: 'Integração com Active Directory' },
    { icon: <Lock size={16} />, label: 'Conformidade com a LGPD' },
  ]

  const submitting = busy || isLoading

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault()
    clearAuthError()
    setBusy(true)
    try {
      const challenge = await beginLogin({ username, password })
      setMfaToken(challenge.mfaToken)
      setDisplayName(challenge.displayName)
      setPassword('')
      if (challenge.status === 'mfa_enrollment_required') {
        const next = await beginEnrollment(challenge.mfaToken)
        setEnrollment(next)
        setStep('enroll')
      } else {
        setStep('challenge')
      }
    } catch {
      // Erro exibido via authError
    } finally {
      setBusy(false)
    }
  }

  const handleEnroll = async (event: React.FormEvent) => {
    event.preventDefault()
    clearAuthError()
    setBusy(true)
    try {
      const result = await finishEnrollment(mfaToken, code)
      setBackupCodes(result.backupCodes)
      setPendingUser(result.user)
      setCode('')
      setStep('backup')
    } catch {
      // Erro exibido via authError
    } finally {
      setBusy(false)
    }
  }

  const handleChallenge = async (event: React.FormEvent) => {
    event.preventDefault()
    clearAuthError()
    setBusy(true)
    try {
      await finishChallenge(mfaToken, code)
    } catch {
      // Erro exibido via authError
    } finally {
      setBusy(false)
    }
  }

  const handleEnterApp = () => {
    if (pendingUser) applySession(pendingUser)
  }

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const backToCredentials = () => {
    clearAuthError()
    setStep('credentials')
    setMfaToken('')
    setEnrollment(null)
    setCode('')
    setUseBackup(false)
    setBackupCodes([])
    setPendingUser(null)
    setSavedCodes(false)
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
              <div key={feature.label} className="flex items-center gap-3 text-blue-50">
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
            Active Directory · MFA · n8n · OpenAI
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="w-full max-w-[420px] relative z-10">
          <div className="flex lg:hidden mb-8 justify-center">
            <Logo size={40} showWordmark />
          </div>

          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {step === 'credentials' && 'Bem-vindo ao DocRH'}
              {step === 'enroll' && 'Ative o autenticador'}
              {step === 'challenge' && 'Verificação em duas etapas'}
              {step === 'backup' && 'Salve seus códigos'}
            </h2>
            <p className="text-[var(--text-secondary)] mt-1.5 text-sm">
              {step === 'credentials' && 'Entre com suas credenciais do domínio corporativo'}
              {step === 'enroll' && `Olá, ${displayName}. Este cadastro é obrigatório.`}
              {step === 'challenge' && `Olá, ${displayName}. Informe o código do autenticador.`}
              {step === 'backup' && 'Guarde estes códigos em um lugar seguro. Eles só aparecem agora.'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/90 backdrop-blur-sm p-7 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/30">
            {step === 'credentials' && (
              <>
                <div className="flex justify-center mb-6">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <Lock size={12} />
                    Active Directory (LDAP)
                  </span>
                </div>
                <form onSubmit={handleCredentials} className="space-y-4">
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
                        disabled={submitting}
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
                        disabled={submitting}
                        required
                        className="input-field pl-10 text-sm h-11 rounded-xl"
                      />
                    </div>
                  </div>
                  {authError && <AuthError message={authError} />}
                  <SubmitButton busy={submitting} idleLabel="Entrar" idleIcon={<Lock size={16} />} />
                </form>
              </>
            )}

            {step === 'enroll' && enrollment && (
              <form onSubmit={handleEnroll} className="space-y-4">
                <div className="flex justify-center mb-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <Smartphone size={12} />
                    Google Authenticator, Authy ou similar
                  </span>
                </div>
                <div className="flex justify-center py-2">
                  <QrCode value={enrollment.otpauthUrl} size={180} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed">
                  Não consegue escanear? Digite a chave no app:
                  <span className="block font-mono text-[var(--text-secondary)] mt-1 break-all">{enrollment.secret}</span>
                </p>
                <div>
                  <label htmlFor="enroll-code" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                    Código de 6 dígitos
                  </label>
                  <input
                    id="enroll-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    disabled={submitting}
                    required
                    className="input-field text-center tracking-[0.4em] text-lg h-11 rounded-xl font-mono"
                  />
                </div>
                {authError && <AuthError message={authError} />}
                <SubmitButton busy={submitting} idleLabel="Confirmar e continuar" idleIcon={<Shield size={16} />} />
                <button type="button" onClick={backToCredentials} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center justify-center gap-1">
                  <ArrowLeft size={12} /> Voltar ao login
                </button>
              </form>
            )}

            {step === 'challenge' && (
              <form onSubmit={handleChallenge} className="space-y-4">
                <div className="flex justify-center mb-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                    {useBackup ? <KeyRound size={12} /> : <Smartphone size={12} />}
                    {useBackup ? 'Código de recuperação' : 'App autenticador'}
                  </span>
                </div>
                <div>
                  <label htmlFor="mfa-code" className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                    {useBackup ? 'Código de backup' : 'Código de 6 dígitos'}
                  </label>
                  <input
                    id="mfa-code"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={e => setCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={useBackup ? 'XXXX-XXXX' : '000000'}
                    disabled={submitting}
                    required
                    className={`input-field text-center h-11 rounded-xl font-mono ${useBackup ? 'tracking-widest' : 'tracking-[0.4em] text-lg'}`}
                  />
                </div>
                {authError && <AuthError message={authError} />}
                <SubmitButton
                  busy={submitting}
                  idleLabel={useBackup ? 'Usar código de recuperação' : 'Verificar'}
                  idleIcon={useBackup ? <KeyRound size={16} /> : <Shield size={16} />}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseBackup(!useBackup)
                    setCode('')
                    clearAuthError()
                  }}
                  className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {useBackup ? 'Usar o app autenticador' : 'Perdi o autenticador — usar código de recuperação'}
                </button>
                <button type="button" onClick={backToCredentials} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center justify-center gap-1">
                  <ArrowLeft size={12} /> Voltar ao login
                </button>
              </form>
            )}

            {step === 'backup' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map(item => (
                    <div key={item} className="font-mono text-xs text-center py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]">
                      {item}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={copyBackupCodes}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                >
                  <Copy size={12} />
                  {copied ? 'Copiado' : 'Copiar códigos'}
                </button>
                <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={savedCodes}
                    onChange={e => setSavedCodes(e.target.checked)}
                    className="mt-0.5"
                  />
                  Guardei estes códigos em um lugar seguro. Sem eles, só o suporte de TI consegue resetar o MFA.
                </label>
                <button
                  type="button"
                  disabled={!savedCodes}
                  onClick={handleEnterApp}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white font-medium rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={16} />
                  Entrar no DocRH
                </button>
              </div>
            )}

            {step === 'credentials' && (
              <div className="mt-6 space-y-2">
                {[
                  'Autenticação via LDAP no Active Directory',
                  'MFA obrigatório com app autenticador',
                  'Sessão protegida · Tokens seguros',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
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

function AuthError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
      <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 dark:text-red-300">{message}</p>
    </div>
  )
}

function SubmitButton({
  busy,
  idleLabel,
  idleIcon,
}: {
  busy: boolean
  idleLabel: string
  idleIcon: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full flex items-center justify-center gap-2.5 py-3 px-4 mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white font-medium rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md shadow-indigo-500/25"
    >
      {busy ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Autenticando...</span>
        </>
      ) : (
        <>
          {idleIcon}
          <span>{idleLabel}</span>
        </>
      )}
    </button>
  )
}
