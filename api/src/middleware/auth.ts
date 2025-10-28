import { Context, Next } from 'hono'
import { verifyToken } from '../utils/jwt'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - No token provided' }, 401)
  }
  
  const token = authHeader.substring(7)
  const payload = verifyToken(token)
  
  if (!payload) {
    return c.json({ error: 'Unauthorized - Invalid token' }, 401)
  }
  
  c.set('user', payload)
  await next()
}

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user')
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin access required' }, 403)
  }
  
  await next()
}
