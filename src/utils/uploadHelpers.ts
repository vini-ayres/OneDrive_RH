/** Limite de upload no browser (base64 aumenta ~33% o payload). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'rtf', 'odt', 'ods',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
  'zip', '7z', 'rar',
])

export interface FileAttachmentMeta {
  name: string
  size: number
  type: string
  folderPath: string
}

/**
 * Extrai o caminho da pasta OneDrive a partir do prompt do usuário.
 * Exemplos aceitos:
 * - "envie para a pasta /RH/Uploads"
 * - "salve na pasta RH/Documentos/Contratos"
 * - "pasta: /RH/Temp"
 * - "/RH/Funcionarios/Joao"
 */
export function extractFolderPathFromPrompt(query: string): string | null {
  const text = query.trim()
  if (!text) return null

  const patterns: RegExp[] = [
    /(?:pasta|folder|diret[oó]rio|caminho)\s*[:=]\s*["']?(\/?[^\n"'<>|*?]{1,200}?)["']?(?=\s|$|[.,;!?])/i,
    /(?:para|em|na|no)\s+(?:a\s+)?(?:pasta|folder|diret[oó]rio)\s+["']?(\/?[^\n"'<>|*?]{1,200}?)["']?(?=\s|$|[.,;!?])/i,
    /(?:envie|enviar|salve|salvar|suba|subir|fa[cç]a\s+upload|upload).*?(?:para|em|na|no)\s+["']?(\/[^\n"'<>|*?]{1,200}?)["']?(?=\s|$|[.,;!?])/i,
    /(?:^|\s)(\/(?:[\w.\-À-ú]+\/)*[\w.\-À-ú]+)(?=\s|$|[.,;!?])/u,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue

    const normalized = normalizeFolderPath(match[1])
    if (normalized) return normalized
  }

  return null
}

export function normalizeFolderPath(raw: string): string | null {
  let path = raw.trim()
  path = path.replace(/^["'`]+|["'`]+$/g, '')
  path = path.replace(/\\/g, '/')
  path = path.replace(/\/{2,}/g, '/')
  path = path.replace(/\/+$/, '')

  if (!path) return null

  // Remover prefixos conversacionais residuais
  path = path.replace(/^(?:a|o|pasta|folder|diret[oó]rio)\s+/i, '').trim()
  if (!path) return null

  if (!path.startsWith('/')) {
    path = `/${path}`
  }

  // Bloquear path traversal e caracteres inválidos
  if (path.includes('..') || /[<>"|*?]/.test(path)) {
    return null
  }

  // Exige pelo menos um segmento útil
  if (path === '/' || path.length < 2) {
    return null
  }

  return path
}

export function validateUploadFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (!file || !(file instanceof File)) {
    return { ok: false, reason: 'Arquivo inválido.' }
  }

  if (file.size <= 0) {
    return { ok: false, reason: 'O arquivo selecionado está vazio.' }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `O arquivo excede o limite de ${formatFileSize(MAX_UPLOAD_BYTES)}.`,
    }
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason: `Tipo de arquivo .${extension || '?'} não permitido.`,
    }
  }

  return { ok: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Libera referências locais do arquivo após o envio.
 * No browser o File já é temporário (memória); limpamos preview URL e input.
 */
export function releaseLocalFile(options: {
  objectUrl?: string | null
  input?: HTMLInputElement | null
}): void {
  if (options.objectUrl) {
    try {
      URL.revokeObjectURL(options.objectUrl)
    } catch {
      // ignore
    }
  }

  if (options.input) {
    options.input.value = ''
  }
}

/**
 * Converte um File/Blob em string base64 (sem prefixo data:).
 */
export async function fileToBase64(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}
