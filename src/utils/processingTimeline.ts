import { ProcessingStep } from '../types'

export interface TimelineStage {
  id: string
  labels: string[]
  /** Tempo nesta etapa antes de avançar. Use Infinity na última. */
  durationMs: number
  /** Intervalo para alternar labels enquanto a etapa continua. */
  cycleMs?: number
}

export const CHAT_PROCESSING_TIMELINE: TimelineStage[] = [
  { id: 'auth', labels: ['Verificando autenticação...'], durationMs: 700 },
  { id: 'send', labels: ['Enviando sua consulta...'], durationMs: 1000 },
  { id: 'search', labels: ['Consultando OneDrive e SharePoint...'], durationMs: 1700 },
  { id: 'index', labels: ['Localizando documentos relevantes...'], durationMs: 1900 },
  { id: 'analyze', labels: ['Analisando o conteúdo encontrado...'], durationMs: 2300 },
  { id: 'compose', labels: ['Organizando as informações...'], durationMs: 2100 },
  {
    id: 'generate',
    labels: [
      'Gerando a resposta...',
      'Cruzando trechos dos documentos...',
      'Ajustando a redação...',
      'Revisando o resultado...',
      'Quase pronto...',
    ],
    durationMs: Number.POSITIVE_INFINITY,
    cycleMs: 2400,
  },
]

export const UPLOAD_PROCESSING_TIMELINE: TimelineStage[] = [
  { id: 'auth', labels: ['Verificando autenticação...'], durationMs: 600 },
  { id: 'prepare', labels: ['Preparando o arquivo para envio...'], durationMs: 900 },
  { id: 'upload', labels: ['Enviando para o OneDrive...'], durationMs: 1600 },
  { id: 'process', labels: ['Processando o arquivo no destino...'], durationMs: 2000 },
  {
    id: 'confirm',
    labels: [
      'Confirmando o envio...',
      'Registrando no OneDrive...',
      'Quase pronto...',
    ],
    durationMs: Number.POSITIVE_INFINITY,
    cycleMs: 2200,
  },
]

export function serializeSteps(steps: ProcessingStep[]): string {
  return steps.map((step) => `${step.id}:${step.status}:${step.label}`).join('|')
}

export function stepsForElapsed(timeline: TimelineStage[], elapsedMs: number): ProcessingStep[] {
  const starts: number[] = []
  let acc = 0
  for (const stage of timeline) {
    starts.push(acc)
    acc += Number.isFinite(stage.durationMs) ? stage.durationMs : 0
  }

  const lastIndex = timeline.length - 1
  let runningIndex = lastIndex
  for (let index = 0; index < lastIndex; index++) {
    if (elapsedMs < starts[index] + timeline[index].durationMs) {
      runningIndex = index
      break
    }
  }

  return timeline.map((stage, index) => {
    if (index < runningIndex) {
      return {
        id: stage.id,
        label: stage.labels[0],
        status: 'done' as const,
        timestamp: new Date(),
      }
    }

    if (index === runningIndex) {
      const stageElapsed = Math.max(0, elapsedMs - starts[index])
      const cycle = stage.cycleMs || 2500
      const labelIndex =
        stage.labels.length > 1 ? Math.floor(stageElapsed / cycle) % stage.labels.length : 0
      return {
        id: stage.id,
        label: stage.labels[labelIndex],
        status: 'running' as const,
        timestamp: new Date(),
      }
    }

    return {
      id: stage.id,
      label: stage.labels[0],
      status: 'pending' as const,
    }
  })
}

export function completeTimeline(timeline: TimelineStage[]): ProcessingStep[] {
  return timeline.map((stage) => ({
    id: stage.id,
    label: stage.labels[0],
    status: 'done' as const,
    timestamp: new Date(),
  }))
}

export function failTimeline(steps: ProcessingStep[]): ProcessingStep[] {
  return steps.map((step) => {
    if (step.status === 'running' || step.status === 'pending') {
      return { ...step, status: 'error' as const }
    }
    return step
  })
}
