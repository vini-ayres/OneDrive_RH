import React from 'react'
import { ProcessingStep } from '../../types'
import { CheckCircle, Circle, Loader2, AlertCircle, Search, FileText, Cpu } from 'lucide-react'

interface TypingIndicatorProps {
  steps?: ProcessingStep[]
}

const stepIcons: Record<string, React.ReactNode> = {
  auth: <CheckCircle size={12} />,
  search: <Search size={12} />,
  analyze: <FileText size={12} />,
  generate: <Cpu size={12} />,
}

export function TypingIndicator({ steps }: TypingIndicatorProps) {
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
    <div className="space-y-1.5 py-1">
      {steps.map(step => (
        <div key={step.id} className="flex items-center gap-2 text-xs">
          <StepIcon step={step} />
          <span className={`${
            step.status === 'done' 
              ? 'text-[var(--text-muted)] line-through'
              : step.status === 'running'
              ? 'text-blue-600 dark:text-blue-400 font-medium'
              : step.status === 'error'
              ? 'text-red-500'
              : 'text-[var(--text-muted)]'
          }`}>
            {step.label}
          </span>
          {step.status === 'running' && (
            <span className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
      ))}
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
