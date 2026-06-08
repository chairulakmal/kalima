import { adminSessionToken, safeEqual } from '../utils/adminAuth'

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event)
  if (!pathname.startsWith('/api/admin/')) return
  if (pathname === '/api/admin/auth') return // login endpoint guards itself

  const cookie = getCookie(event, 'admin_session')
  const token = adminSessionToken()

  if (!token || !cookie || !safeEqual(cookie, token)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
})
