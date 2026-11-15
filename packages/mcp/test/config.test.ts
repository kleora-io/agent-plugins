import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BASE_URL, DEFAULT_CLIENT_ID, loadConfig } from '../src/config.js'
import { TOOLSETS } from '../src/types.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('loadConfig', () => {
  it('needs nothing but defaults: the API base URL and a profile name, nothing else', () => {
    vi.stubEnv('KLEORA_MCP_BASE_URL', '')
    vi.stubEnv('KLEORA_MCP_ISSUER', '')
    const config = loadConfig({ argv: [] })

    expect(config.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(config.clientId).toBe(DEFAULT_CLIENT_ID)
    expect(config.profile).toBe('default')
    expect(config.readOnly).toBe(false)
    expect(config.toolsets).toEqual(TOOLSETS)
  })

  it('a plugin setting left empty falls back to its default, however the host passes it', () => {
    // The plugin manifest substitutes `${user_config.*}` into these; an empty
    // field can arrive empty, blank or as the unfilled placeholder itself.
    vi.stubEnv('KLEORA_MCP_BASE_URL', '${user_config.api_base_url}')
    vi.stubEnv('KLEORA_MCP_PROFILE', '  ')
    vi.stubEnv('KLEORA_MCP_ISSUER', '${user_config.issuer}')
    vi.stubEnv('KLEORA_MCP_READ_ONLY', '${user_config.read_only}')
    const config = loadConfig({ argv: [] })

    expect(config.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(config.profile).toBe('default')
    expect(config.issuer).toBeUndefined()
    expect(config.readOnly).toBe(false)
  })

  it('derives no issuer from the API host — the API is asked instead', () => {
    // The hosted API (kleora.io) and its issuers (kleora.eu) share no domain,
    // so nothing about the API's hostname says where the issuer is.
    vi.stubEnv('KLEORA_MCP_ISSUER', '')
    for (const baseUrl of [
      'https://api.kleora.io',
      'https://api.example.com',
      'http://api.example.test:8080',
      'http://127.0.0.1:8080',
    ]) {
      expect(loadConfig({ argv: [`--base-url=${baseUrl}`] }).issuer).toBeUndefined()
    }
  })

  it('an explicit --issuer is kept, for a topology the API cannot describe', () => {
    const config = loadConfig({
      argv: ['--base-url=https://api.kleora.io', '--issuer=https://sso.example.test/'],
    })
    expect(config.issuer).toBe('https://sso.example.test')
  })

  it('KLEORA_MCP_ISSUER is the same override from the environment', () => {
    vi.stubEnv('KLEORA_MCP_ISSUER', 'http://id.example.test:8080')
    expect(loadConfig({ argv: [] }).issuer).toBe('http://id.example.test:8080')
  })

  it('--read-only and both spellings of a valued flag', () => {
    const config = loadConfig({ argv: ['--read-only', '--profile=work', '--toolsets', 'core,audit'] })
    expect(config.readOnly).toBe(true)
    expect(config.profile).toBe('work')
    expect(config.toolsets).toEqual(['core', 'audit'])
  })

  it('an argv flag wins over the environment', () => {
    vi.stubEnv('KLEORA_MCP_PROFILE', 'from-env')
    const config = loadConfig({ argv: ['--profile=from-argv'] })
    expect(config.profile).toBe('from-argv')
  })

  it('refuses an unknown toolset rather than silently ignoring it', () => {
    expect(() => loadConfig({ argv: ['--toolsets=core,branding'] })).toThrow(/unknown toolset/)
  })

  it('never reads a credential — there is no KLEORA_MCP_* variable for one', () => {
    const source = loadConfig.toString()
    expect(source).not.toMatch(/refresh.?token/i)
    expect(source).not.toMatch(/access.?token/i)
  })
})
