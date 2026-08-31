import React, { useEffect, useState } from 'react'
import { Shield, Smartphone, KeyRound, Loader2, Copy, AlertCircle, CheckCircle } from 'lucide-react'
import { QrCode } from '../ui/QrCode'
import {
  confirmMfaReplace,
  fetchMfaStatus,
  regenerateMfaBackupCodes,
  startMfaReplace,
  type MfaEnrollmentStart,
  type MfaStatus,
} from '../../services/authService'

export function MfaSettingsCard({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [replace, setReplace] = useState<MfaEnrollmentStart | null>(null)
  const [mode, setMode] = useState<'idle' | 'regenerate' | 'replace-start' | 'replace-confirm'>('idle')
  const [copied, setCopied] = useState(false)

  const reload = async () => {
    try {
      setStatus(await fetchMfaStatus(accessToken))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar o MFA.')
    }
  }

  useEffect(() => {
    void reload()
  }, [accessToken])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.')
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = () =>
    run(async () => {
      const codes = await regenerateMfaBackupCodes(accessToken, code)
      setBackupCodes(codes)
      setCode('')
      setMode('idle')
      await reload()
    })

  const handleReplaceStart = () =>
    run(async () => {
      const next = await startMfaReplace(accessToken, code)
      setReplace(next)
      setCode('')
      setMode('replace-confirm')
    })

  const handleReplaceConfirm = () =>
    run(async () => {
      await confirmMfaReplace(accessToken, code)
      setReplace(null)
      setCode('')
      setMode('idle')
      await reload()
    })

  const copyCodes = async () => {
    if (!backupCodes) return
    await navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
        <Smartphone size={15} />
        Autenticação em duas etapas
      </h3>

      {loadError && (
        <p className="text-xs text-red-600 mb-3">{loadError}</p>
      )}

      <div className="flex items-center justify-between py-2 gap-3">
        <div>
          <p className="font-medium text-[var(--text-primary)] text-sm">Status</p>
          <p className="text-xs text-[var(--text-muted)]">
            Obrigatório para todos os usuários. Não é possível desligar.
          </p>
        </div>
        <span className={status?.enabled ? 'badge-green' : 'badge-yellow'}>
          {status?.enabled ? 'Ativo' : 'Pendente'}
        </span>
      </div>
      <hr className="border-[var(--border-color)] my-2" />
      <div className="flex items-center justify-between py-2 gap-3">
        <div>
          <p className="font-medium text-[var(--text-primary)] text-sm">Códigos de recuperação</p>
          <p className="text-xs text-[var(--text-muted)]">
            {status ? `${status.backupCodesRemaining} restante(s)` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMode('regenerate'); setError(null); setBackupCodes(null) }}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Regenerar
        </button>
      </div>
      <hr className="border-[var(--border-color)] my-2" />
      <div className="flex items-center justify-between py-2 gap-3">
        <div>
          <p className="font-medium text-[var(--text-primary)] text-sm">Trocar autenticador</p>
          <p className="text-xs text-[var(--text-muted)]">
            Use se perdeu o celular, mas ainda consegue gerar um código atual — ou após um login com backup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMode('replace-start'); setError(null); setReplace(null) }}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Trocar
        </button>
      </div>

      {mode === 'regenerate' && (
        <MfaCodePrompt
          title="Confirme com o autenticador para gerar novos códigos"
          code={code}
          onCode={setCode}
          busy={busy}
          error={error}
          onCancel={() => { setMode('idle'); setCode('') }}
          onSubmit={handleRegenerate}
        />
      )}

      {mode === 'replace-start' && (
        <MfaCodePrompt
          title="Informe o código atual do autenticador"
          code={code}
          onCode={setCode}
          busy={busy}
          error={error}
          onCancel={() => { setMode('idle'); setCode('') }}
          onSubmit={handleReplaceStart}
        />
      )}

      {mode === 'replace-confirm' && replace && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Escaneie o novo QR no app e confirme o código gerado.
          </p>
          <div className="flex justify-center">
            <QrCode value={replace.otpauthUrl} size={160} />
          </div>
          <p className="text-[11px] text-center font-mono text-[var(--text-muted)] break-all">{replace.secret}</p>
          <MfaCodePrompt
            title="Código do novo autenticador"
            code={code}
            onCode={setCode}
            busy={busy}
            error={error}
            onCancel={() => { setMode('idle'); setCode(''); setReplace(null) }}
            onSubmit={handleReplaceConfirm}
          />
        </div>
      )}

      {backupCodes && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-3">
          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
            <CheckCircle size={12} className="text-emerald-500" />
            Novos códigos — os anteriores deixaram de valer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map(item => (
              <div key={item} className="font-mono text-xs text-center py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {item}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={copyCodes}
            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl border border-[var(--border-color)]"
          >
            <Copy size={12} />
            {copied ? 'Copiado' : 'Copiar códigos'}
          </button>
        </div>
      )}
    </div>
  )
}

function MfaCodePrompt({
  title,
  code,
  onCode,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  title: string
  code: string
  onCode: (value: string) => void
  busy: boolean
  error: string | null
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form
      className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
        <KeyRound size={12} />
        {title}
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={e => onCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="input-field text-center tracking-[0.4em] font-mono h-10 rounded-xl"
        required
      />
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 text-xs py-2 rounded-xl border border-[var(--border-color)]">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="flex-1 text-xs py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
          Confirmar
        </button>
      </div>
    </form>
  )
}
