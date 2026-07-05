import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'

export const ACCESS_COOKIE = 'at'
export const REFRESH_COOKIE = 'rt'
const ACCESS_TTL = 60 * 15 // 15 min
const REFRESH_TTL = 60 * 60 * 24 * 30 // 30 days

export interface AccessClaims { sub: string, role: string, jti: string }
export interface RefreshClaims { sub: string, sid: string }

function accessSecret() {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || useRuntimeConfig().jwtAccessSecret as string)
}
function refreshSecret() {
  return new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || useRuntimeConfig().jwtRefreshSecret as string)
}

export async function signAccessToken(sub: string, role: string, jti: string) {
  return await new SignJWT({ role, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(accessSecret())
}

export async function signRefreshToken(sub: string, sid: string) {
  return await new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret())
  return { sub: payload.sub as string, role: payload.role as string, jti: payload.jti as string }
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, refreshSecret())
  return { sub: payload.sub as string, sid: (payload as { sid: string }).sid }
}

export function setAuthCookies(event: H3Event, access: string, refresh: string) {
  const secure = !import.meta.dev
  setCookie(event, ACCESS_COOKIE, access, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL
  })
  setCookie(event, REFRESH_COOKIE, refresh, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: REFRESH_TTL
  })
}

export function clearAuthCookies(event: H3Event) {
  deleteCookie(event, ACCESS_COOKIE, { path: '/' })
  deleteCookie(event, REFRESH_COOKIE, { path: '/' })
}

export const REFRESH_TTL_SECONDS = REFRESH_TTL
