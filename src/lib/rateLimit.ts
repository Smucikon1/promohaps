// Prosty rate limiter w pamięci procesu. Zabezpiecza trasy AI przed pętlą
// (skradziona sesja admina paląca budżet Anthropic). Na Vercel każda instancja
// serverless ma własną mapę — w praktyce OK przy jednym adminie i małym ruchu;
// pod większym obciążeniem podmienić na Upstash Ratelimit.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function checkLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  b.count += 1
  return { ok: true, retryAfter: 0 }
}
