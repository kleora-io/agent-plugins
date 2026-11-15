/**
 * The gate on `plugins/claude-code`, the artefact a person installs.
 *
 * It lives in this package's suite rather than beside the plugin because this
 * is where the server it carries is built and tested. CI runs it on every
 * change, so a skill-only change runs it too.
 *
 * What is worth asserting here is the set of mistakes that are silent in
 * production: a `${user_config.…}` key that does not exist (the substitution
 * is left as a literal, and the server quietly runs on defaults), an
 * environment variable the server does not read, a skill naming a tool that
 * was renamed or removed, and a committed bundle that has drifted from `src`
 * or picked up an import an installed plugin cannot resolve.
 */
import { execFileSync } from 'node:child_process'
import { builtinModules } from 'node:module'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_TOOLS } from '../src/tools/build.js'
import { VERSION } from '../src/version.js'

const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const PLUGIN = join(REPO, 'plugins', 'claude-code')

const read = (...parts: string[]): string => readFileSync(join(...parts), 'utf8')
const readJson = (...parts: string[]): Record<string, unknown> =>
  JSON.parse(read(...parts)) as Record<string, unknown>

const manifest = readJson(PLUGIN, '.claude-plugin', 'plugin.json')
const marketplace = readJson(REPO, '.claude-plugin', 'marketplace.json')

/** Every `.md` the plugin ships — skills, commands and the two READMEs. */
function prose(): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.md')) files.push({ path: full.slice(PLUGIN.length + 1), text: read(full) })
    }
  }
  walk(PLUGIN)
  return files
}

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (match === null) return {}
  const fields: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1 || line.startsWith(' ')) continue
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return fields
}

describe('the plugin manifest', () => {
  it('is the plugin the marketplace offers, at the version of the server it carries', () => {
    expect(manifest['name']).toBe('kleora')
    // One version for the plugin and the server inside it: a person reading
    // `claude plugin list` is reading the server's version too.
    expect(manifest['version']).toBe(VERSION)

    const plugins = marketplace['plugins'] as { name: string; source: string }[]
    const entry = plugins.find((candidate) => candidate.name === manifest['name'])
    expect(entry).toBeDefined()
    expect(entry!.source).toBe('./plugins/claude-code')
  })

  it('launches the committed bundle through CLAUDE_PLUGIN_ROOT, never an absolute path', () => {
    const servers = manifest['mcpServers'] as Record<string, { command: string; args: string[] }>
    const server = servers['kleora']
    expect(server).toBeDefined()
    expect(server!.command).toBe('node')
    expect(server!.args).toEqual(['${CLAUDE_PLUGIN_ROOT}/server/kleora-mcp.mjs'])
    // The path the substitution resolves to has to be a file we ship.
    expect(statSync(join(PLUGIN, 'server', 'kleora-mcp.mjs')).isFile()).toBe(true)
  })

  it('substitutes only declared user_config keys, into variables the server reads', () => {
    const declared = Object.keys(manifest['userConfig'] as Record<string, unknown>)
    const servers = manifest['mcpServers'] as Record<string, { env?: Record<string, string> }>
    const env = servers['kleora']?.env ?? {}

    // A `${user_config.typo}` is not an error anywhere — it is left as a
    // literal and the server silently starts on its defaults.
    for (const value of Object.values(env)) {
      const match = /^\$\{user_config\.([a-z_]+)\}$/.exec(value)
      expect(match, `${value} is not a user_config substitution`).not.toBeNull()
      expect(declared).toContain(match![1])
    }

    // And the other half: the names have to be the ones `config.ts` reads.
    const source = read(fileURLToPath(new URL('../src/config.ts', import.meta.url)))
    for (const name of Object.keys(env)) {
      expect(name.startsWith('KLEORA_MCP_')).toBe(true)
      expect(source).toContain(`env('${name.slice('KLEORA_MCP_'.length)}')`)
    }
  })

  it('declares no user configuration that could hold a credential', () => {
    const userConfig = manifest['userConfig'] as Record<string, Record<string, unknown>>
    // A token is never an environment variable and never a command-line
    // argument. A `sensitive` field here would be a third place
    // a secret could be typed, and there is nothing it could legitimately hold.
    for (const [key, field] of Object.entries(userConfig)) {
      expect(field['sensitive'], `${key} is marked sensitive`).toBeUndefined()
      expect(key).not.toMatch(/secret|token|password|api_key/)
    }
  })
})

describe('skills and commands', () => {
  const skillsDir = join(PLUGIN, 'skills')
  const skills = readdirSync(skillsDir).filter((entry) => statSync(join(skillsDir, entry)).isDirectory())

  it('ships the five subject skills, plus the ground rules', () => {
    expect(skills.sort()).toEqual([
      'add-to-your-app',
      'apps-and-clients',
      'audit-log',
      'members-and-roles',
      'sandbox-to-production',
      'using-kleora',
    ])
  })

  it.each(skills)('%s has a SKILL.md whose name matches its directory and says when to use it', (skill) => {
    const fields = frontmatter(read(skillsDir, skill, 'SKILL.md'))
    expect(fields['name']).toBe(skill)
    // The description is what a host matches a request against; an empty or
    // one-word one is a skill that never loads.
    expect((fields['description'] ?? '').length).toBeGreaterThan(80)
  })

  it.each(readdirSync(join(PLUGIN, 'commands')))('command %s has a description', (file) => {
    expect(frontmatter(read(PLUGIN, 'commands', file))['description']).toBeTruthy()
  })

  it('names only tools that exist', () => {
    const names = new Set(ALL_TOOLS.map((tool) => tool.name))
    const missing: string[] = []
    for (const { path, text } of prose()) {
      for (const [mentioned] of text.matchAll(/kleora_[a-z0-9_]+/g)) {
        // `kleora_mcp` is the OAuth client's id, not a tool.
        if (mentioned === 'kleora_mcp') continue
        if (!names.has(mentioned)) missing.push(`${path}: ${mentioned}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('carries nothing that only works on the machine that wrote it', () => {
    const offenders: string[] = []
    for (const { path, text } of prose()) {
      // A `*.localhost` name is a development issuer on somebody's own
      // machine, and the plugin is read by strangers: no such examples
      // presented as real. A bare `http://localhost` is a different thing
      // entirely — it is the reader's own dev server, and saying that sandbox
      // accepts one is the point of that paragraph.
      const internal = text.match(/[A-Za-z0-9-]+\.localhost/g)
      if (internal !== null) offenders.push(`${path}: ${internal[0]}`)
      if (/\/Users\/|\/home\/[a-z]/.test(text)) offenders.push(`${path}: absolute home path`)
      // A live-looking key or secret must never reach a public artefact.
      if (/kl_(live|test)_[A-Za-z0-9]{8,}/.test(text)) offenders.push(`${path}: key-shaped literal`)
    }
    expect(offenders).toEqual([])
  })
})

describe('the committed server bundle', () => {
  const bundle = read(PLUGIN, 'server', 'kleora-mcp.mjs')

  it('says it is generated, and by what', () => {
    expect(bundle.startsWith('#!/usr/bin/env node\n')).toBe(true)
    expect(bundle).toContain('GENERATED FILE — do not edit.')
    expect(bundle).toContain('pnpm plugin-server')
  })

  it('imports nothing an installed plugin could not resolve', () => {
    // No `node_modules` exists beside an installed plugin, so every remaining
    // import has to be a Node builtin — or the one optional native module the
    // credential store loads inside a `try`.
    const allowed = new Set([
      ...builtinModules,
      ...builtinModules.map((name) => `node:${name}`),
      '@napi-rs/keyring',
    ])
    const specifiers = [...bundle.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]!)
    expect(specifiers.length).toBeGreaterThan(0)
    expect(specifiers.filter((specifier) => !allowed.has(specifier))).toEqual([])
  })

  it('starts, reports its configuration and exits cleanly on --logout with nothing stored', () => {
    // The end-to-end proof that the one file is runnable on its own: run it
    // from a directory with no `node_modules` at all, in `--logout` mode so it
    // neither connects to stdio nor needs a network. A throwaway HOME, so the
    // run reads no real credential and leaves no lock file behind.
    const home = mkdtempSync(join(tmpdir(), 'kleora-mcp-plugin-test-'))
    try {
      const output = execFileSync(
        process.execPath,
        [
          join(PLUGIN, 'server', 'kleora-mcp.mjs'),
          '--logout',
          '--base-url=https://api.example.com',
          '--profile=plugin-test-not-a-real-profile',
        ],
        { cwd: home, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } },
      )
      expect(output).toContain('no stored credential')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
