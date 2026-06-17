import React, { useState, useEffect } from 'react'
import { Clock, AlertTriangle, X } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useAuth } from '../../hooks/useAuth'

export function SessionWarning() {
  const { state } = useApp()
  const { logout } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState(0)

  useEffect(() => {
    if (!state.sessionExpiresAt) return

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((state.sessionExpiresAt!.getTime() - Date.now()) / 60000))
      setMinutesRemaining(remaining)
      if (remaining > 5) setDismissed(false) // Reset dismissed state when time is recovered
    }

    updateTimer()
    const interval = setInterval(updateTimer, 30000)
    return () => clearInterval(interval)
  }, [state.sessionExpiresAt])

  // Show warning when 5 minutes or less remaining
  if (!state.isAuthenticated || minutesRemaining > 5 || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-fade-in">
      <div className="bg-[var(--bg-primary)] border-2 border-yellow-400 dark:border-yellow-600 rounded-xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[var(--text-primary)]">
              Sessão expirando
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {minutesRemaining <= 0
                ? 'Sua sessão expirou. Faça login novamente.'
                : `Sua sessão expira em ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`
              }
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Clique em qualquer lugar para renovar.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={logout}
            className="flex-1 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Sair Agora
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full bg-[var(--bg-tertiary)] rounded-full h-1">
          <div
            className="bg-yellow-500 h-1 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, (minutesRemaining / 5) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
