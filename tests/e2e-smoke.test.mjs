import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const electronExecutable = require('electron')

describe('e2e smoke', () => {
  it('build artifacts exist', () => {
    assert.ok(existsSync(path.join(projectRoot, 'out/main/index.js')))
    assert.ok(existsSync(path.join(projectRoot, 'out/renderer/index.html')))
  })

  it('electron main process starts without crash', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tododesk-e2e-'))

    await new Promise((resolve, reject) => {
      const child = spawn(
        electronExecutable,
        [path.join(projectRoot, 'out/main/index.js')],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            TODODESK_DATA_DIR: dataDir,
            TODODESK_E2E: '1',
            ELECTRON_RENDERER_URL: ''
          },
          stdio: 'ignore'
        }
      )

      const timer = setTimeout(() => {
        child.kill()
        resolve(undefined)
      }, 5000)

      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })

      child.once('exit', (code) => {
        clearTimeout(timer)
        if (code !== null && code !== 0) {
          reject(new Error(`Electron exited with code ${code}`))
          return
        }
        resolve(undefined)
      })
    })
  })
})