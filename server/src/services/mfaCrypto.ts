import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'

const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const BACKUP_CODE_COUNT = 10
const BACKUP_CODE_LEN = 8

function mfaKey(): Buffer {
  const raw = env.authMfaEncryptionKey
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  return createHash('sha256').update(raw).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', mfaKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted secret')
  }
  const decipher = createDecipheriv('aes-256-gcm', mfaKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  while (codes.length < BACKUP_CODE_COUNT) {
    const raw = randomBytes(BACKUP_CODE_LEN)
    let code = ''
    for (let i = 0; i < BACKUP_CODE_LEN; i++) {
      code += BACKUP_ALPHABET[raw[i] % BACKUP_ALPHABET.length]
    }
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`
    if (!codes.includes(formatted)) codes.push(formatted)
  }
  return codes
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function hashBackupCode(code: string): string {
  return createHmac('sha256', env.authMfaPepper).update(normalizeBackupCode(code)).digest('hex')
}

export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(hashBackupCode)
}

export function findMatchingBackupHash(code: string, hashes: string[]): string | null {
  const target = Buffer.from(hashBackupCode(code), 'hex')
  for (const hash of hashes) {
    const candidate = Buffer.from(hash, 'hex')
    if (candidate.length !== target.length) continue
    if (timingSafeEqual(target, candidate)) return hash
  }
  return null
}

export function looksLikeTotp(code: string): boolean {
  return /^\d{6}$/.test(code.replace(/\s+/g, ''))
}
