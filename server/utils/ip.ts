import { networkInterfaces } from 'node:os'
import { getRequestIP, type H3Event } from 'h3'

const IPV6_LOOPBACK = '0000:0000:0000:0000:0000:0000:0000:0001'

function expandIpv6(ip: string) {
  if (!ip.includes(':')) return ip

  const [head = '', tail = ''] = ip.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const missing = Math.max(0, 8 - headParts.length - tailParts.length)
  const parts = [
    ...headParts,
    ...Array.from({ length: missing }, () => '0'),
    ...tailParts
  ]

  if (parts.length !== 8) return ip
  return parts.map(part => part.padStart(4, '0').toLowerCase()).join(':')
}

export function normalizeIpAddress(ip?: string | null) {
  if (!ip) return null
  const value = ip.trim()
  if (!value) return null

  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : expandIpv6(value.slice(1, end))
  }

  return expandIpv6(value)
}

function isLoopback(ip?: string | null) {
  return ip === IPV6_LOOPBACK || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost'
}

function ipv4Rank(ip: string) {
  if (ip.startsWith('192.168.')) return 0
  if (ip.startsWith('10.')) return 1

  const parts = ip.split('.').map(Number)
  const first = parts[0]
  const second = parts[1]
  if (first == null || second == null) return 3
  if (first === 172 && second >= 16 && second <= 31) return 2

  return 3
}

function getLanIpv4Address() {
  const candidates = Object.values(networkInterfaces())
    .flatMap(iface => iface ?? [])
    .filter(addr => addr.family === 'IPv4' && !addr.internal)
    .map(addr => addr.address)
    .sort((a, b) => ipv4Rank(a) - ipv4Rank(b))

  return candidates[0] ?? null
}

export function preferLanIpv4ForLoopback(ip?: string | null) {
  const normalized = normalizeIpAddress(ip)
  if (!isLoopback(normalized)) return normalized
  return getLanIpv4Address() ?? normalized
}

export function getClientIpAddress(event: H3Event) {
  return preferLanIpv4ForLoopback(getRequestIP(event, { xForwardedFor: true }))
}
