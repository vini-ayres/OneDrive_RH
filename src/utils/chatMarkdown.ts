import DOMPurify from 'dompurify'
import { isSecureUrl } from './security'

const CHAT_MARKDOWN_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'src', 'action'],
  KEEP_CONTENT: true,
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineMarkdown(line: string): string {
  let formatted = escapeHtml(line)

  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const trimmedUrl = String(url).trim()
    if (!isSecureUrl(trimmedUrl)) {
      return escapeHtml(String(label))
    }

    return `<a href="${escapeHtml(trimmedUrl)}" target="_blank" rel="noopener noreferrer" class="chat-link">${escapeHtml(String(label))}</a>`
  })

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  formatted = formatted.replace(/`([^`]+?)`/g, '<code class="chat-inline-code">$1</code>')

  return formatted
}

function normalizeChatText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim()
}

/**
 * Converte markdown simples (links, listas, negrito, quebras) em HTML seguro para o chat.
 */
export function formatChatMarkdown(raw: string): string {
  const text = normalizeChatText(raw)
  if (!text) return ''

  const lines = text.split('\n')
  const parts: string[] = []
  let index = 0

  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === '') {
      index++
    }

    if (index >= lines.length) break

    const numberedMatch = lines[index].match(/^(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      const items: string[] = []

      while (index < lines.length) {
        const match = lines[index].match(/^(\d+)\.\s+(.*)$/)
        if (!match) break

        const itemLines = [applyInlineMarkdown(match[2])]
        index++

        while (
          index < lines.length &&
          lines[index].trim() !== '' &&
          !/^\d+\.\s+/.test(lines[index])
        ) {
          itemLines.push(applyInlineMarkdown(lines[index]))
          index++
        }

        items.push(`<li class="chat-list-item">${itemLines.join('<br />')}</li>`)
      }

      parts.push(`<ol class="chat-ordered-list">${items.join('')}</ol>`)
      continue
    }

    const bulletMatch = lines[index].match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      const items: string[] = []

      while (index < lines.length) {
        const match = lines[index].match(/^[-*]\s+(.*)$/)
        if (!match) break

        items.push(`<li class="chat-list-item">${applyInlineMarkdown(match[1])}</li>`)
        index++
      }

      parts.push(`<ul class="chat-bullet-list">${items.join('')}</ul>`)
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index])
    ) {
      const line = lines[index]

      if (/^#{1,3}\s+/.test(line)) {
        if (paragraphLines.length > 0) {
          parts.push(`<p class="chat-paragraph">${paragraphLines.join('<br />')}</p>`)
          paragraphLines.length = 0
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const tag = `h${level}`
          parts.push(`<${tag} class="chat-heading">${applyInlineMarkdown(headingMatch[2])}</${tag}>`)
        }

        index++
        continue
      }

      paragraphLines.push(applyInlineMarkdown(line))
      index++
    }

    if (paragraphLines.length > 0) {
      parts.push(`<p class="chat-paragraph">${paragraphLines.join('<br />')}</p>`)
    }
  }

  return DOMPurify.sanitize(parts.join(''), CHAT_MARKDOWN_CONFIG)
}
