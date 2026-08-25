import DOMPurify from 'dompurify'

// Configuração do DOMPurify para sanitização segura
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  ALLOWED_ATTR: ['class'],
  FORBID_SCRIPTS: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'href', 'src', 'action'],
  KEEP_CONTENT: true,
}

/**
 * Sanitiza HTML para prevenir XSS
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, DOMPURIFY_CONFIG)
}

/**
 * Sanitiza texto puro - remove qualquer HTML
 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Valida e sanitiza uma query de chat
 * Bloqueia tentativas de injeção e inputs maliciosos
 */
export function sanitizeChatQuery(input: string): { safe: string; blocked: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: '', blocked: true, reason: 'Input inválido' }
  }

  // Remover caracteres de controle
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Verificar tamanho máximo (2000 caracteres)
  if (cleaned.length > 2000) {
    return { safe: '', blocked: true, reason: 'Query excede o limite de 2000 caracteres' }
  }

  // Detectar padrões de injeção
  const injectionPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /import\s*\(/i,
  ]

  for (const pattern of injectionPatterns) {
    if (pattern.test(cleaned)) {
      return { safe: '', blocked: true, reason: 'Conteúdo potencialmente malicioso detectado' }
    }
  }

  // Sanitizar o texto
  const safe = sanitizeText(cleaned).trim()

  if (!safe) {
    return { safe: '', blocked: true, reason: 'Query vazia após sanitização' }
  }

  return { safe, blocked: false }
}

/**
 * Verifica se uma URL é segura para exibir
 */
export function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      ['https:', 'http:'].includes(parsed.protocol) &&
      !url.includes('javascript:') &&
      !url.includes('data:') &&
      !url.includes('vbscript:')
    )
  } catch {
    return false
  }
}

/**
 * Extrai um nome curto de arquivo a partir da URL (SharePoint/OneDrive).
 */
export function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const fromQuery = parsed.searchParams.get('file') || parsed.searchParams.get('name')
    if (fromQuery?.trim()) return decodeURIComponent(fromQuery.trim())

    const segments = parsed.pathname.split('/').filter(Boolean)
    for (let i = segments.length - 1; i >= 0; i--) {
      const decoded = decodeURIComponent(segments[i] || '').trim()
      if (!decoded || decoded.startsWith(':')) continue
      if (decoded.includes('.') || i === segments.length - 1) return decoded
    }
  } catch {
    // ignore
  }
  return 'Abrir documento'
}

export function documentLinkLabel(name: string | undefined, url: string): string {
  const trimmed = name?.trim()
  if (trimmed && !/^https?:\/\//i.test(trimmed) && trimmed.length <= 120) {
    return trimmed
  }
  return fileNameFromUrl(url)
}

/**
 * Mascara dados sensíveis para logs
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'cpf', 'rg', 'salary', 'salario']
  const masked: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k))
    if (isSensitive) {
      masked[key] = '***MASKED***'
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>)
    } else {
      masked[key] = value
    }
  }

  return masked
}

/**
 * Gera um ID de sessão seguro
 */
export function generateSessionId(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Gera um CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

/**
 * Remove IDs técnicos internos da resposta da API
 * Nunca exibir: file_id, drive_id, item_id, etc.
 */
export function sanitizeApiResponse(text: string): string {
  // Remover padrões de IDs técnicos
  const patterns = [
    /file_id:\s*["']?[a-zA-Z0-9_-]+["']?/gi,
    /drive_id:\s*["']?[a-zA-Z0-9_-]+["']?/gi,
    /item_id:\s*["']?[a-zA-Z0-9_-]+["']?/gi,
    /"id":\s*"[0-9A-F]{32,}"/gi,
    /driveItem:[a-zA-Z0-9_!%]+/gi,
  ]

  let cleaned = text
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  return cleaned
}

/**
 * Verifica se o token JWT está expirado
 */
export function isTokenExpired(expiresOn: Date | null): boolean {
  if (!expiresOn) return true
  const bufferMs = 5 * 60 * 1000 // 5 minutos de buffer
  return new Date() >= new Date(expiresOn.getTime() - bufferMs)
}

/**
 * Obtém IP do cliente (melhor esforço no frontend)
 */
export async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) })
    const data = await res.json() as { ip: string }
    return data.ip
  } catch {
    return 'unknown'
  }
}
