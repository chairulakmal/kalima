import { adminSessionToken, safeEqual } from '../../utils/adminAuth'
import { throttle, clientKey } from '../../utils/throttle'

export default defineEventHandler(async (event) => {
  // Brute-force guard: 5 attempts per IP per 15 minutes.
  const gate = throttle(clientKey(event, 'admin-login'), 5, 15 * 60_000)
  if (!gate.allowed) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Try again later.' })
  }

  const { password } = await readBody<{ password?: string }>(event)
  const expected = process.env.ADMIN_PASSWORD
  const token = adminSessionToken()

  if (!expected || !token || typeof password !== 'string' || !safeEqual(password, expected)) {
    throw createError({ statusCode: 401, message: 'Invalid password' })
  }

  setCookie(event, 'admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return { ok: true }
})
