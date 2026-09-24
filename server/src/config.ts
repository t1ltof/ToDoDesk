function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing env ${name}`)
  }
  return value
}

export const config = {
  host: process.env.HOST?.trim() || '127.0.0.1',
  port: Number(process.env.PORT || 8790),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  publicUrl: process.env.PUBLIC_URL?.trim() || 'http://127.0.0.1:8790',
  allowSignup: process.env.ALLOW_SIGNUP === 'true',
  accessTtl: '15m',
  refreshDays: 30
}
