import { readFileSync } from 'fs'
import { decrypt, getDataPassword, isEncrypted } from './encryption'

export function readDataFileContent(path: string): string {
  const raw = readFileSync(path, 'utf-8')
  if (!isEncrypted(raw)) return raw

  const password = getDataPassword()
  if (!password) throw new Error('Файл зашифрован — введите пароль в настройках')
  return decrypt(raw, password)
}