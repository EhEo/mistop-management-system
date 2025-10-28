import 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    user: {
      userId: string
      email: string
      role: string
    }
  }
}
