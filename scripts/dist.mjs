import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createPackage } from '@electron/asar'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const winUnpacked = join(root, 'release', 'win-unpacked')
const appAsar = join(winUnpacked, 'resources', 'app.asar')
const staging = join(root, '.app-staging')

const env = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
}

function run(command) {
  execSync(command, { cwd: root, stdio: 'inherit', env })
}

function ensureWinUnpacked() {
  if (existsSync(join(winUnpacked, 'ToDoDesk.exe'))) return

  console.log('release/win-unpacked не найден — полная упаковка electron-builder...')
  try {
    run('npx electron-builder --win dir')
  } catch {
    console.error(
      'Не удалось создать win-unpacked (часто из-за сети ECONNRESET).\n' +
        'Скопируйте папку release/win-unpacked с прошлой сборки или повторите позже.'
    )
    process.exit(1)
  }
}

async function packAppAsar() {
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  cpSync(join(root, 'package.json'), join(staging, 'package.json'))
  cpSync(join(root, 'out'), join(staging, 'out'), { recursive: true })
  mkdirSync(dirname(appAsar), { recursive: true })
  await createPackage(staging, appAsar)
  rmSync(staging, { recursive: true, force: true })
}

console.log('→ electron-vite build')
run('npm run build')

ensureWinUnpacked()

console.log('→ pack app.asar')
await packAppAsar()

console.log('→ portable exe')
run('npx electron-builder --win portable --prepackaged release/win-unpacked')

console.log('Готово: release/ToDoDesk-*-portable.exe')