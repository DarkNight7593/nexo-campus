import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

interface PythonCommand { executable: string; prefix: string[] }

function samCliBundledPython(): string | undefined {
  if (process.platform !== 'win32') return undefined
  const located = spawnSync('where.exe', ['sam.cmd'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const samCommand = String(located.stdout ?? '').split(/\r?\n/).find(Boolean)
  if (!samCommand) return undefined
  const candidate = path.resolve(path.dirname(samCommand), '..', 'runtime', 'python.exe')
  return fs.existsSync(candidate) ? candidate : undefined
}

function candidates(): PythonCommand[] {
  const configured = process.env.PYTHON_EXECUTABLE?.trim()
  const bundled = samCliBundledPython()
  return [
    ...(configured ? [{ executable: configured, prefix: [] }] : []),
    ...(process.platform === 'win32'
      ? [{ executable: 'py', prefix: ['-3'] }, { executable: 'python', prefix: [] }]
      : [{ executable: 'python3', prefix: [] }, { executable: 'python', prefix: [] }]),
    ...(bundled ? [{ executable: bundled, prefix: [] }] : [])
  ]
}

const selected = candidates().find(({ executable, prefix }) => {
  const probe = spawnSync(executable, [...prefix, '--version'], { stdio: 'ignore' })
  return !probe.error && probe.status === 0
})

if (!selected) {
  throw new Error('No se encontró Python 3. Configura PYTHON_EXECUTABLE o instala Python y abre una terminal nueva.')
}

const result = spawnSync(selected.executable, [...selected.prefix, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) throw result.error
process.exit(result.status ?? 1)
