import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'release', 'win-unpacked')
const target = join(root, 'release', 'ToDoDesk-win-unpacked-bootstrap.zip')

if (!existsSync(join(source, 'ToDoDesk.exe'))) {
  console.error('Нет release/win-unpacked — сначала соберите portable хотя бы один раз.')
  process.exit(1)
}

execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${source}' -DestinationPath '${target}' -Force"`,
  { stdio: 'inherit' }
)

console.log(`Готово: ${target}`)