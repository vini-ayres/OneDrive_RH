const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

type Bucket = {
  failures: number
  lockedUntil: number
}

const buckets = new Map<string, Bucket>()

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil > 0 && bucket.lockedUntil < now && bucket.failures === 0) {
      buckets.delete(key)
    }
  }
}

export function rateLimitKey(ip: string, username: string): string {
  return `${ip.trim() || 'unknown'}::${username.trim().toLowerCase()}`
}

export function getRateLimitStatus(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.lockedUntil <= now) {
    return { locked: false, retryAfterSec: 0 }
  }
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)) }
}

export function recordAuthFailure(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { failures: 0, lockedUntil: 0 }
  if (bucket.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)) }
  }

  bucket.failures += 1
  if (bucket.failures >= MAX_FAILURES) {
    bucket.lockedUntil = now + WINDOW_MS
    bucket.failures = 0
  }
  buckets.set(key, bucket)

  if (bucket.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)) }
  }
  return { locked: false, retryAfterSec: 0 }
}

export function clearAuthFailures(key: string) {
  buckets.delete(key)
}

export const MFA_LOCKOUT_MINUTES = 15
export const MFA_MAX_FAILURES = MAX_FAILURES
