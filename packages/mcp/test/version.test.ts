/**
 * One version for the server and the plugin that carries it, held by
 * `scripts/check-versions.mjs`, which CI and the release both run.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VERSION } from '../src/version.js'

const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const SCRIPT = join(REPO, 'scripts', 'check-versions.mjs')

describe('VERSION', () => {
  it('matches package.json, so the two cannot drift', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
    expect(VERSION).toBe(manifest.version)
  })
})

describe('check-versions', () => {
  let root: string

  /** A copy of just the files the check reads, to break one at a time. */
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kleora-check-versions-'))
    for (const path of [
      'packages/mcp/package.json',
      'packages/mcp/src/version.ts',
      'plugins/claude-code/.claude-plugin/plugin.json',
      'plugins/claude-code/package.json',
      '.claude-plugin/marketplace.json',
    ]) {
      cpSync(join(REPO, path), join(root, path), { recursive: true })
    }
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function run(...args: string[]): { ok: boolean; output: string } {
    try {
      const output = execFileSync(process.execPath, [SCRIPT, `--root=${root}`, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, output }
    } catch (error) {
      const failure = error as { stderr: string }
      return { ok: false, output: failure.stderr }
    }
  }

  function edit(path: string, change: (value: Record<string, unknown>) => void): void {
    const file = join(root, path)
    const value = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    change(value)
    writeFileSync(file, JSON.stringify(value))
  }

  it('passes on this repository, and on the version it is at', () => {
    expect(run().ok).toBe(true)
    expect(run(VERSION).ok).toBe(true)
  })

  it('fails when the plugin and the server name different versions', () => {
    edit('plugins/claude-code/.claude-plugin/plugin.json', (plugin) => {
      plugin['version'] = '9.9.9'
    })
    const result = run()
    expect(result.ok).toBe(false)
    expect(result.output).toContain('plugin.json version: 9.9.9')
  })

  it('fails when the release asks for a version the manifests are not at', () => {
    const result = run('v9.9.9')
    expect(result.ok).toBe(false)
    expect(result.output).toContain(`at ${VERSION}, not 9.9.9`)
  })

  it('fails on a dependency nobody outside a workspace can resolve', () => {
    edit('packages/mcp/package.json', (manifest) => {
      ;(manifest['dependencies'] as Record<string, string>)['@kleora-io/core'] = 'workspace:*'
    })
    const result = run()
    expect(result.ok).toBe(false)
    expect(result.output).toContain('@kleora-io/core: workspace:*')
  })

  it('fails when the repository npm would compare against is not this one', () => {
    edit('packages/mcp/package.json', (manifest) => {
      manifest['repository'] = { type: 'git', url: 'git+https://github.com/somebody/else.git' }
    })
    const result = run()
    expect(result.ok).toBe(false)
    expect(result.output).toContain('repository.url')
  })
})
