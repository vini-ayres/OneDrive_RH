import { createHmac, randomBytes } from 'node:crypto'
import { env } from '../env.js'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function buildOtpauthUrl(username: string, secret: string): string {
  const issuer = encodeURIComponent(env.authMfaIssuer)
  const label = encodeURIComponent(`${env.authMfaIssuer}:${username}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

export function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  const key = base32Decode(secret)
  const now = Math.floor(Date.now() / 1000 / 30)

  for (let offset = -window; offset <= window; offset++) {
    if (timingSafeEqual(hotp(key, now + offset), normalized)) {
      return true
    }
  }

  return false
}

function hotp(key: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)

  const hmac = createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  let diff = 0
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i]
  }
  return diff === 0
}
