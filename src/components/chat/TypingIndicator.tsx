import React, { useEffect, useMemo, useState } from 'react'
import { ProcessingStep } from '../../types'
import {
  CheckCircle, Circle, Loader2, AlertCircle, Search, FileText, Cpu,
  Shield, Send, FolderSearch, Sparkles, ListChecks, Package, Upload, Scan,
} from 'lucide-react'

interface TypingIndicatorProps {
  steps?: ProcessingStep[]
}

const stepIcons: Record<string, React.ReactNode> = {
  auth: <Shield size={12} />,
  send: <Send size={12} />,
  search: <Search size={12} />,
  index: <FolderSearch size={12} />,
  analyze: <FileText size={12} />,
  compose: <ListChecks size={12} />,
  generate: <Sparkles size={12} />,
  prepare: <Package size={12} />,
  upload: <Upload size={12} />,
  process: <Scan size={12} />,
  confirm: <Cpu size={12} />,
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TypingIndicator({ steps }: TypingIndicatorProps) {
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  const runningStep = steps?.find((step) => step.status === 'running')
  const allDone = Boolean(steps?.length && steps.every((step) => step.status === 'done'))

  const progress = useMemo(() => {
    if (!steps || steps.length === 0) return 12
    if (steps.every((step) => step.status === 'done')) return 100
    const done = steps.filter((step) => step.status === 'done').length
    const running = steps.some((step) => step.status === 'running')
    return Math.min(96, ((done + (running ? 0.55 : 0)) / steps.length) * 100)
  }, [steps])

  if (!steps || steps.length === 0) {
    return (
      <div className="flex items-center gap-1.5 py-2 px-1">
        <div className="flex gap-1">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
        <span className="text-xs text-[var(--text-muted)]">Processando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2.5 py-0.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {allDone ? (
            <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
          ) : (
            <Loader2 size={13} className="text-blue-500 animate-spin flex-shrink-0" />
          )}
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">
            {allDone
              ? 'Pronto. Abrindo a resposta...'
              : runningStep?.label || 'Processando sua mensagem...'}
          </p>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums flex-shrink-0">
          {formatElapsed(elapsedSec)}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400 animate-processing-bar"
          style={{ width: `${progress}%`, transition: 'width 0.45s ease-out' }}
        />
      </div>

      <div className="space-y-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 text-xs rounded-md px-1.5 py-1 -mx-1.5 transition-all duration-300 ${
              step.status === 'running'
                ? 'bg-blue-50 dark:bg-blue-900/25'
                : step.status === 'done'
                  ? 'opacity-70'
                  : 'opacity-45'
            }`}
            style={{ animation: `processingStepIn 0.35s ease-out ${index * 45}ms both` }}
          >
            <StepIcon step={step} />
            <span
              key={step.label}
              className={`min-w-0 truncate animate-processing-label ${
                step.status === 'done'
                  ? 'text-[var(--text-muted)]'
                  : step.status === 'running'
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : step.status === 'error'
                      ? 'text-red-500'
                      : 'text-[var(--text-muted)]'
              }`}
            >
              {step.label}
            </span>
            {step.status === 'running' && (
              <span className="flex gap-0.5 ml-auto flex-shrink-0">
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
            {step.status === 'done' && (
              <span className="ml-auto text-[10px] text-green-600 dark:text-green-400 flex-shrink-0">ok</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepIcon({ step }: { step: ProcessingStep }) {
  const baseIcon = stepIcons[step.id]

  switch (step.status) {
    case 'done':
      return <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
    case 'running':
      return <Loader2 size={12} className="text-blue-500 animate-spin flex-shrink-0" />
    case 'error':
      return <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
    case 'pending':
      return (
        <span className="text-[var(--text-muted)] flex-shrink-0">
          {baseIcon || <Circle size={12} />}
        </span>
      )
    default:
      return <Circle size={12} className="text-[var(--text-muted)] flex-shrink-0" />
  }
}
